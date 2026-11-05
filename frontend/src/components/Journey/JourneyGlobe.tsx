import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
import { useCallback, useEffect, useMemo, useRef } from "react";
import "cesium/Build/Cesium/Widgets/widgets.css";
import {
  ArcType,
  BoundingSphere,
  CallbackPositionProperty,
  CallbackProperty,
  Cartesian2,
  Cartesian3,
  Color,
  ConstantProperty,
  HeadingPitchRange,
  HorizontalOrigin,
  LabelStyle,
  Math as CesiumMath,
  Ellipsoid,
  PolylineGlowMaterialProperty,
  VerticalOrigin,
  Viewer,
} from "cesium";
import { JourneyAnimator } from "./JourneyAnimator";
import {
  createVehicleBillboard,
  getVehicleBillboardRenderKey,
  JOURNEY_VEHICLE_DISABLE_DEPTH_TEST_DISTANCE,
} from "./VehicleBillboard";
import {
  smoothCameraFollowPose,
  type CameraFollowPose,
} from "./cameraFollow.ts";
import { getJourneySegmentBearing } from "./journeyBearing.ts";
import { addGlobeWorld } from "./globeWorld.ts";
import {
  createJourneyWaypointAvatarSvg,
  getJourneyWaypointPresentation,
} from "./journeyWaypointPopup.ts";
import {
  BIOME_DEFINITIONS,
  BIOME_ORDER,
} from "./globeBiomeData.ts";
import { getVehicleTransitionProgress, type VehicleTransition } from "./vehicleMotion.ts";
import { CATEGORY_COLORS } from "../Map/ItemMarker";
import type { Entity } from "cesium";
import type {
  AnimationState,
  JourneyWaypoint,
  VehicleType,
  JourneySpeed,
} from "../../types/journey";

interface JourneyGlobeProps {
  origin: {
    latitude: number;
    longitude: number;
    title: string;
  };
  waypoints: JourneyWaypoint[];
  profileEmoji: string;
  profileColor: string;
  isPlaying: boolean;
  speedMultiplier: JourneySpeed;
  onStateChange: (state: AnimationState) => void;
  onWaypointArrive: (index: number, waypoint: JourneyWaypoint) => void;
  onComplete: () => void;
}

function toCartesian(
  latitude: number,
  longitude: number,
  height = 180000,
): Cartesian3 {
  return Cartesian3.fromDegrees(longitude, latitude, height);
}

function toSurfaceCartesian(latitude: number, longitude: number): Cartesian3 {
  return Cartesian3.fromDegrees(longitude, latitude, 0);
}

export function JourneyGlobe({
  origin,
  waypoints,
  profileEmoji,
  profileColor,
  isPlaying,
  speedMultiplier,
  onStateChange,
  onWaypointArrive,
  onComplete,
}: JourneyGlobeProps) {
  useUiLanguage();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const animatorRef = useRef<JourneyAnimator | null>(null);
  const statusRef = useRef<AnimationState["status"]>("idle");
  const vehicleRef = useRef<VehicleType>("car");
  const vehicleTransitionRef = useRef<{
    from: VehicleType;
    startedAtMs: number;
  } | null>(null);
  const currentPositionRef = useRef(
    toCartesian(origin.latitude, origin.longitude),
  );
  const currentBearingRef = useRef(0);
  const trailPositionsRef = useRef<Cartesian3[]>([
    toSurfaceCartesian(origin.latitude, origin.longitude),
  ]);
  const waypointEntityRefs = useRef<Entity[]>([]);
  const vehicleEntityRef = useRef<Entity | null>(null);
  const cameraFollowFrameRef = useRef<number | null>(null);
  const cameraFollowLastTimestampRef = useRef<number | null>(null);
  const cameraFollowPoseRef = useRef<CameraFollowPose | null>(null);
  const cameraBearingRef = useRef<number | null>(null);
  const motionPhaseRef = useRef(0);
  const vehicleBillboardKeyRef = useRef<string | null>(null);
  const vehicleTransitionProgressRef = useRef<VehicleTransition | undefined>(undefined);
  const arrivalPopupEntityRef = useRef<Entity | null>(null);
  const arrivalPopupTimeoutRef = useRef<number | null>(null);

  const routeSurfacePositions = useMemo(
    () =>
      [origin, ...waypoints].map((point) =>
        toSurfaceCartesian(point.latitude, point.longitude),
      ),
    [origin, waypoints],
  );

  const updateVehicleBillboard = useCallback((transition?: VehicleTransition) => {
    const billboard = vehicleEntityRef.current?.billboard;
    if (!billboard) return;

    const renderKey = getVehicleBillboardRenderKey(
      vehicleRef.current,
      currentBearingRef.current,
      motionPhaseRef.current,
      transition,
      cameraBearingRef.current ?? undefined,
    );
    if (vehicleBillboardKeyRef.current === renderKey) return;
    vehicleBillboardKeyRef.current = renderKey;

    billboard.image = new ConstantProperty(createVehicleBillboard(
      vehicleRef.current,
      profileEmoji,
      profileColor,
      currentBearingRef.current,
      1,
      motionPhaseRef.current,
      transition,
      cameraBearingRef.current ?? undefined,
    ));
  }, [profileColor, profileEmoji]);

  const updateCameraRelativeVehicleView = useCallback(() => {
    const viewer = viewerRef.current;
    if (!viewer || !vehicleEntityRef.current) return;

    const vehicleCartographic = Ellipsoid.WGS84.cartesianToCartographic(
      currentPositionRef.current,
    );
    const cameraCartographic = Ellipsoid.WGS84.cartesianToCartographic(
      viewer.camera.positionWC,
    );
    if (!vehicleCartographic || !cameraCartographic) return;

    cameraBearingRef.current = getJourneySegmentBearing(
      [
        CesiumMath.toDegrees(vehicleCartographic.longitude),
        CesiumMath.toDegrees(vehicleCartographic.latitude),
      ],
      [
        CesiumMath.toDegrees(cameraCartographic.longitude),
        CesiumMath.toDegrees(cameraCartographic.latitude),
      ],
    );
    updateVehicleBillboard(vehicleTransitionProgressRef.current);
  }, [updateVehicleBillboard]);

  const clearArrivalPopup = useCallback(() => {
    if (arrivalPopupTimeoutRef.current !== null) {
      window.clearTimeout(arrivalPopupTimeoutRef.current);
      arrivalPopupTimeoutRef.current = null;
    }
    const viewer = viewerRef.current;
    if (arrivalPopupEntityRef.current && viewer && !viewer.isDestroyed()) {
      viewer.entities.remove(arrivalPopupEntityRef.current);
    }
    arrivalPopupEntityRef.current = null;
  }, []);

  const showArrivalPopup = useCallback((waypoint: JourneyWaypoint) => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    clearArrivalPopup();
    const presentation = getJourneyWaypointPresentation(waypoint);
    const surfacePosition = toSurfaceCartesian(
      waypoint.latitude,
      waypoint.longitude,
    );
    const popupPosition = toCartesian(
      waypoint.latitude,
      waypoint.longitude,
      320000,
    );

    arrivalPopupEntityRef.current = viewer.entities.add({
      position: popupPosition,
      polyline: {
        positions: [surfacePosition, popupPosition],
        width: 3,
        material: Color.fromCssColorString(presentation.color).withAlpha(0.9),
      },
      billboard: {
        image: createJourneyWaypointAvatarSvg(waypoint),
        width: 58,
        height: 58,
        verticalOrigin: VerticalOrigin.BOTTOM,
        horizontalOrigin: HorizontalOrigin.CENTER,
      },
      label: {
        text: presentation.title,
        font: "700 15px sans-serif",
        fillColor: Color.fromCssColorString("#0F172A"),
        outlineColor: Color.WHITE,
        outlineWidth: 3,
        showBackground: true,
        backgroundColor: Color.WHITE.withAlpha(0.96),
        style: LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cartesian2(0, -62),
        verticalOrigin: VerticalOrigin.BOTTOM,
      },
    });
    arrivalPopupTimeoutRef.current = window.setTimeout(clearArrivalPopup, 2200);
  }, [clearArrivalPopup]);

  const resetSceneState = useCallback(() => {
    currentPositionRef.current = toCartesian(origin.latitude, origin.longitude);
    trailPositionsRef.current = [
      toSurfaceCartesian(origin.latitude, origin.longitude),
    ];
    vehicleRef.current = "car";
    vehicleTransitionRef.current = null;
    vehicleBillboardKeyRef.current = null;
    cameraBearingRef.current = null;
    motionPhaseRef.current = 0;
    vehicleTransitionProgressRef.current = undefined;
    cameraFollowLastTimestampRef.current = null;
    cameraFollowPoseRef.current = null;
    clearArrivalPopup();
    waypointEntityRefs.current.forEach((entity) => {
      if (entity.point) {
        entity.point.color = new ConstantProperty(Color.fromCssColorString("#FFFFFF"));
        entity.point.outlineColor = new ConstantProperty(Color.fromCssColorString("#1F2937"));
      }
    });
    if (vehicleEntityRef.current?.billboard) {
      vehicleEntityRef.current.billboard.image = new ConstantProperty(createVehicleBillboard(
        vehicleRef.current,
        profileEmoji,
        profileColor,
        0,
        1,
      ));
    }
  }, [
    origin.latitude,
    origin.longitude,
    profileColor,
    profileEmoji,
  ]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const viewer = new Viewer(container, {
      animation: false,
      baseLayer: false,
      baseLayerPicker: false,
      fullscreenButton: false,
      geocoder: false,
      homeButton: false,
      infoBox: false,
      navigationHelpButton: false,
      sceneModePicker: false,
      selectionIndicator: false,
      timeline: false,
    });

    viewer.scene.globe.enableLighting = true;
    viewer.scene.globe.baseColor = Color.fromCssColorString("#123D86");
    if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = true;
    if (viewer.scene.moon) viewer.scene.moon.show = false;
    viewer.scene.screenSpaceCameraController.enableTilt = false;
    viewer.scene.screenSpaceCameraController.minimumZoomDistance = 1200000;
    viewer.scene.screenSpaceCameraController.maximumZoomDistance = 35000000;
    viewerRef.current = viewer;
    // Static terrain belongs to the viewer, not to an individual replay route.
    const removeGlobeWorld = addGlobeWorld(viewer);

    return () => {
      animatorRef.current?.dispose();
      animatorRef.current = null;
      clearArrivalPopup();
      if (cameraFollowFrameRef.current !== null) {
        cancelAnimationFrame(cameraFollowFrameRef.current);
        cameraFollowFrameRef.current = null;
      }
      cameraFollowLastTimestampRef.current = null;
      cameraFollowPoseRef.current = null;
      waypointEntityRefs.current = [];
      vehicleEntityRef.current = null;
      removeGlobeWorld();
      viewer.destroy();
      viewerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    animatorRef.current?.dispose();
    animatorRef.current = null;
    viewer.entities.removeAll();
    waypointEntityRefs.current = [];
    vehicleEntityRef.current = null;
    statusRef.current = "idle";

    if (waypoints.length < 1) {
      onStateChange({
        status: "idle",
        currentSegment: 0,
        segmentProgress: 0,
        totalSegments: 0,
      });
      return;
    }

    resetSceneState();

    viewer.entities.add({
      polyline: {
        positions: routeSurfacePositions,
        width: 2,
        arcType: ArcType.GEODESIC,
        material: Color.WHITE.withAlpha(0.18),
      },
    });

    viewer.entities.add({
      polyline: {
        positions: new CallbackProperty(() => {
          if (trailPositionsRef.current.length === 0) return [];
          return [
            ...trailPositionsRef.current,
            currentPositionRef.current,
          ];
        }, false),
        width: 6,
        arcType: ArcType.GEODESIC,
        material: new PolylineGlowMaterialProperty({
          color: Color.fromCssColorString("#FBBF24").withAlpha(0.95),
          glowPower: 0.22,
          taperPower: 0.55,
        }),
      },
    });

    vehicleEntityRef.current = viewer.entities.add({
      position: new CallbackPositionProperty(() => currentPositionRef.current, false),
      billboard: {
        image: createVehicleBillboard(
          "car",
          profileEmoji,
          profileColor,
          0,
          1,
        ),
        width: 72,
        height: 72,
        disableDepthTestDistance: JOURNEY_VEHICLE_DISABLE_DEPTH_TEST_DISTANCE,
        verticalOrigin: VerticalOrigin.BOTTOM,
        horizontalOrigin: HorizontalOrigin.CENTER,
      },
      label: {
        text: origin.title,
        font: "600 14px sans-serif",
        fillColor: Color.WHITE,
        outlineColor: Color.fromCssColorString("#0F172A"),
        outlineWidth: 3,
        showBackground: true,
        backgroundColor: Color.fromCssColorString("#0F172A").withAlpha(0.65),
        style: LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cartesian2(0, -74),
        verticalOrigin: VerticalOrigin.BOTTOM,
      },
    });

    waypointEntityRefs.current = waypoints.map((waypoint, index) =>
      viewer.entities.add({
        id: `journey-waypoint-${index}`,
        position: toSurfaceCartesian(waypoint.latitude, waypoint.longitude),
        point: {
          pixelSize: 10,
          color: Color.WHITE,
          outlineColor: Color.fromCssColorString("#1F2937"),
          outlineWidth: 2,
        },
        label: {
          text: waypoint.title,
          font: "600 12px sans-serif",
          fillColor: Color.WHITE,
          outlineColor: Color.fromCssColorString("#0F172A"),
          outlineWidth: 2,
          style: LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cartesian2(0, 14),
          verticalOrigin: VerticalOrigin.TOP,
          scale: 0.85,
        },
      }),
    );

    const boundingSphere = BoundingSphere.fromPoints(routeSurfacePositions);
    viewer.camera.flyToBoundingSphere(boundingSphere, {
      duration: 0,
      offset: new HeadingPitchRange(
        0,
        -0.9,
        Math.max(boundingSphere.radius * 3.2, 7000000),
      ),
    });

    const animator = new JourneyAnimator(origin, waypoints, {
      onPositionUpdate: (
        lat,
        lng,
        bearingDeg,
        _segmentIndex,
        motionPhaseMs,
        lastReachedWaypointIndex,
      ) => {
        currentPositionRef.current = toCartesian(lat, lng);
        currentBearingRef.current = bearingDeg;
        motionPhaseRef.current = motionPhaseMs;
        const transitionState = vehicleTransitionRef.current;
        const transition = transitionState
          ? {
              from: transitionState.from,
              progress: getVehicleTransitionProgress(
                transitionState.startedAtMs,
                motionPhaseMs,
              ),
            }
          : undefined;
        if (transition?.progress === 1) vehicleTransitionRef.current = null;
        vehicleTransitionProgressRef.current = transition?.progress === 1
          ? undefined
          : transition;
        const labelText =
          lastReachedWaypointIndex < 0
            ? origin.title
            : waypoints[lastReachedWaypointIndex]?.title ??
              origin.title;
        if (vehicleEntityRef.current?.billboard) {
          updateVehicleBillboard(vehicleTransitionProgressRef.current);
        }
        const label = vehicleEntityRef.current?.label;
        if (label && label.text?.getValue(viewer.clock.currentTime) !== labelText) {
          label.text = new ConstantProperty(labelText);
        }
      },
      onSegmentChange: (_segmentIndex, vehicle) => {
        if (vehicleRef.current !== vehicle) {
          vehicleTransitionRef.current = {
            from: vehicleRef.current,
            startedAtMs: performance.now(),
          };
        }
        vehicleRef.current = vehicle;
        const transitionState = vehicleTransitionRef.current;
        vehicleTransitionProgressRef.current = transitionState
          ? { from: transitionState.from, progress: 0 }
          : undefined;
        if (vehicleEntityRef.current?.billboard) {
          updateVehicleBillboard(vehicleTransitionProgressRef.current);
        }
      },
      onWaypointArrive: (waypointIndex, waypoint) => {
        trailPositionsRef.current = [
          ...trailPositionsRef.current,
          toSurfaceCartesian(waypoint.latitude, waypoint.longitude),
        ];
        const reachedEntity = waypointEntityRefs.current[waypointIndex];
        if (reachedEntity?.point) {
          const color =
            CATEGORY_COLORS[waypoint.category] ?? "#FBBF24";
          reachedEntity.point.color = new ConstantProperty(Color.fromCssColorString(color));
          reachedEntity.point.outlineColor = new ConstantProperty(Color.WHITE);
        }
        showArrivalPopup(waypoint);
        onWaypointArrive(waypointIndex, waypoint);
      },
      onStateChange: (state) => {
        statusRef.current = state.status;
        onStateChange(state);
      },
      onComplete: () => {
        const lastWaypoint = waypoints[waypoints.length - 1];
        if (lastWaypoint) {
          currentPositionRef.current = toCartesian(
            lastWaypoint.latitude,
            lastWaypoint.longitude,
          );
        }
        onComplete();
      },
    });

    animatorRef.current = animator;
    onStateChange(animator.getState());

    return () => {
      animator.dispose();
      clearArrivalPopup();
      if (animatorRef.current === animator) {
        animatorRef.current = null;
      }
      if (cameraFollowFrameRef.current !== null) {
        cancelAnimationFrame(cameraFollowFrameRef.current);
        cameraFollowFrameRef.current = null;
      }
      cameraFollowLastTimestampRef.current = null;
      cameraFollowPoseRef.current = null;
    };
  }, [
    onComplete,
    onStateChange,
    onWaypointArrive,
    origin,
    profileColor,
    profileEmoji,
    resetSceneState,
    routeSurfacePositions,
    clearArrivalPopup,
    showArrivalPopup,
    updateCameraRelativeVehicleView,
    updateVehicleBillboard,
    waypoints,
  ]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    updateCameraRelativeVehicleView();
    const removeCameraChangedListener = viewer.camera.changed.addEventListener(
      updateCameraRelativeVehicleView,
    );

    return () => {
      removeCameraChangedListener?.();
    };
  }, [updateCameraRelativeVehicleView]);

  useEffect(() => {
    const animator = animatorRef.current;
    const viewer = viewerRef.current;
    if (!animator || !viewer) return;

    const stopCameraFollow = () => {
      if (cameraFollowFrameRef.current !== null) {
        cancelAnimationFrame(cameraFollowFrameRef.current);
        cameraFollowFrameRef.current = null;
      }
      cameraFollowLastTimestampRef.current = null;
      cameraFollowPoseRef.current = null;
    };

    const followCamera = (timestamp: number) => {
      const currentViewer = viewerRef.current;
      if (
        !currentViewer ||
        currentViewer.isDestroyed() ||
        statusRef.current !== "playing"
      ) {
        cameraFollowFrameRef.current = null;
        cameraFollowLastTimestampRef.current = null;
        return;
      }

      const previousTimestamp = cameraFollowLastTimestampRef.current;
      const deltaMs = previousTimestamp === null
        ? 16
        : Math.min(Math.max(timestamp - previousTimestamp, 0), 50);
      cameraFollowLastTimestampRef.current = timestamp;

      const targetPose: CameraFollowPose = {
        headingRadians: CesiumMath.toRadians(currentBearingRef.current),
        pitchRadians: CesiumMath.toRadians(-25),
        range: 4_500_000,
      };
      const currentPose = cameraFollowPoseRef.current ?? {
        headingRadians: CesiumMath.toRadians(
          cameraBearingRef.current ?? currentBearingRef.current,
        ),
        pitchRadians: currentViewer.camera.pitch,
        range: Math.max(
          1_200_000,
          Math.min(
            Cartesian3.distance(
              currentViewer.camera.positionWC,
              currentPositionRef.current,
            ),
            35_000_000,
          ),
        ),
      };
      const nextPose = smoothCameraFollowPose(currentPose, targetPose, deltaMs);
      cameraFollowPoseRef.current = nextPose;

      currentViewer.camera.lookAt(
        currentPositionRef.current,
        new HeadingPitchRange(
          nextPose.headingRadians,
          nextPose.pitchRadians,
          nextPose.range,
        ),
      );

      cameraFollowFrameRef.current = requestAnimationFrame(followCamera);
    };

    const status = statusRef.current;
    if (isPlaying) {
      if (status === "idle") {
        animator.play();
      } else if (status === "paused") {
        animator.resume();
      }

      stopCameraFollow();
      cameraFollowFrameRef.current = requestAnimationFrame(followCamera);
    } else if (status === "playing") {
      animator.pause();
      stopCameraFollow();
    }

    return stopCameraFollow;
  }, [isPlaying]);

  useEffect(() => {
    animatorRef.current?.setSpeed(speedMultiplier);
  }, [speedMultiplier]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-slate-950">
      <div ref={containerRef} className="h-full w-full" />
      <div className="journey-biome-legend" role="group" aria-label={uiText("Generated biome cube legend")}>
        <p className="journey-biome-legend-title">{uiText("Blocky biome world")}</p>
        <div className="journey-biome-legend-items">
          {BIOME_ORDER.map((biome) => (
            <span key={biome} className="journey-biome-legend-item">
              <span
                className="journey-biome-legend-swatch"
                style={{ backgroundColor: BIOME_DEFINITIONS[biome].color }}
                aria-hidden="true"
              />
              {BIOME_DEFINITIONS[biome].label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
