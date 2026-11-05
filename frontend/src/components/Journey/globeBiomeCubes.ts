import {
  BoxGeometry,
  CircleGeometry,
  Cartesian3,
  Color,
  ColorGeometryInstanceAttribute,
  EllipsoidSurfaceAppearance,
  GeometryInstance,
  Material,
  PerInstanceColorAppearance,
  Primitive,
  Rectangle,
  RectangleGeometry,
  SphereGeometry,
  TextureMagnificationFilter,
  TextureMinificationFilter,
  Transforms,
  type Viewer,
} from "cesium";
import { worldLand } from "../Map/worldMapData.ts";
import { getGlobeLandPolygons } from "./globeWorldGeometry.ts";
import {
  BIOME_DEFINITIONS,
  FEATURED_VIETNAM_ARCHIPELAGOS,
  generateBiomeCubes,
  getVoxelOceanShellRadius,
  getVoxelPolarCapRadius,
  VOXEL_BLOCK_HEIGHT_METERS,
  VOXEL_BLOCK_OVERLAP,
  VOXEL_OCEAN_SHELL_HEIGHT_METERS,
  type BiomeCube,
  type FeaturedVietnamArchipelago,
} from "./globeBiomeData.ts";

const CACHED_BIOME_CUBES: readonly BiomeCube[] = generateBiomeCubes(
  getGlobeLandPolygons(worldLand.features),
);

function createBiomeBlock(cube: BiomeCube): GeometryInstance {
  const color = ColorGeometryInstanceAttribute.fromColor(
    Color.fromCssColorString(cube.surfaceColor),
  );

  if (cube.shape === "trapezoid") {
    return new GeometryInstance({
      id: cube.id,
      geometry: new RectangleGeometry({
        rectangle: Rectangle.fromDegrees(
          cube.longitude - cube.longitudeSpan / 2,
          cube.latitude - cube.latitudeSpan / 2,
          cube.longitude + cube.longitudeSpan / 2,
          cube.latitude + cube.latitudeSpan / 2,
        ),
        height: VOXEL_OCEAN_SHELL_HEIGHT_METERS + cube.height,
        extrudedHeight: VOXEL_OCEAN_SHELL_HEIGHT_METERS,
        granularity: Math.PI / 180,
        vertexFormat: PerInstanceColorAppearance.VERTEX_FORMAT,
      }),
      attributes: { color },
    });
  }

  const center = Cartesian3.fromDegrees(
    cube.longitude,
    cube.latitude,
    VOXEL_OCEAN_SHELL_HEIGHT_METERS + cube.height / 2,
  );

  return new GeometryInstance({
    id: cube.id,
    geometry: BoxGeometry.fromDimensions({
      dimensions: new Cartesian3(
        cube.width * VOXEL_BLOCK_OVERLAP,
        cube.depth * VOXEL_BLOCK_OVERLAP,
        cube.height,
      ),
      vertexFormat: PerInstanceColorAppearance.VERTEX_FORMAT,
    }),
    modelMatrix: Transforms.eastNorthUpToFixedFrame(center),
    attributes: {
      color,
    },
  });
}

function createPolarCap(latitude: -90 | 90): GeometryInstance {
  return new GeometryInstance({
    id: latitude > 0 ? "voxel-polar-cap-north" : "voxel-polar-cap-south",
    geometry: new CircleGeometry({
      center: Cartesian3.fromDegrees(0, latitude),
      radius: getVoxelPolarCapRadius() * 1.005,
      height: VOXEL_OCEAN_SHELL_HEIGHT_METERS + VOXEL_BLOCK_HEIGHT_METERS,
      extrudedHeight: VOXEL_OCEAN_SHELL_HEIGHT_METERS,
      granularity: Math.PI / 180,
      vertexFormat: PerInstanceColorAppearance.VERTEX_FORMAT,
    }),
    attributes: {
      color: ColorGeometryInstanceAttribute.fromColor(
        Color.fromCssColorString(BIOME_DEFINITIONS.ice.color),
      ),
    },
  });
}

function createArchipelagoDecal(
  archipelago: FeaturedVietnamArchipelago,
): Primitive {
  const [west, south, east, north] = archipelago.rectangle;
  const material = new Material({
    translucent: true,
    minificationFilter: TextureMinificationFilter.NEAREST,
    magnificationFilter: TextureMagnificationFilter.NEAREST,
    fabric: {
      type: "Image",
      uniforms: {
        image: archipelago.imageUrl,
        color: Color.WHITE,
      },
    },
  });

  return new Primitive({
    allowPicking: false,
    geometryInstances: new GeometryInstance({
      id: `archipelago-decal-${archipelago.label}`,
      geometry: new RectangleGeometry({
        rectangle: Rectangle.fromDegrees(west, south, east, north),
        height:
          VOXEL_OCEAN_SHELL_HEIGHT_METERS +
          VOXEL_BLOCK_HEIGHT_METERS +
          4_000,
        vertexFormat: EllipsoidSurfaceAppearance.VERTEX_FORMAT,
      }),
    }),
    appearance: new EllipsoidSurfaceAppearance({
      aboveGround: true,
      faceForward: true,
      flat: true,
      translucent: true,
      material,
    }),
    asynchronous: true,
  });
}

export function addGlobeBiomeCubes(viewer: Viewer): () => void {
  const oceanShell = viewer.scene.primitives.add(new Primitive({
    allowPicking: false,
    geometryInstances: new GeometryInstance({
      id: "voxel-ocean-shell",
      geometry: SphereGeometry.createGeometry(new SphereGeometry({
        radius: getVoxelOceanShellRadius(),
        stackPartitions: 48,
        slicePartitions: 96,
        vertexFormat: PerInstanceColorAppearance.VERTEX_FORMAT,
      }))!,
      attributes: {
        color: ColorGeometryInstanceAttribute.fromColor(
          Color.fromCssColorString("#176F9D"),
        ),
      },
    }),
    appearance: new PerInstanceColorAppearance({
      flat: false,
      translucent: false,
      closed: true,
    }),
    asynchronous: false,
  }));

  const biomePrimitive = viewer.scene.primitives.add(new Primitive({
    allowPicking: false,
    geometryInstances: [
      ...CACHED_BIOME_CUBES.map(createBiomeBlock),
      createPolarCap(90),
      createPolarCap(-90),
    ],
    appearance: new PerInstanceColorAppearance({
      flat: false,
      translucent: false,
      closed: true,
    }),
    asynchronous: true,
  }));

  const archipelagoDecals = FEATURED_VIETNAM_ARCHIPELAGOS.map((archipelago) =>
    viewer.scene.primitives.add(createArchipelagoDecal(archipelago)),
  );

  return () => {
    if (!viewer.isDestroyed()) {
      for (const decal of archipelagoDecals) {
        viewer.scene.primitives.remove(decal);
      }
      viewer.scene.primitives.remove(biomePrimitive);
      viewer.scene.primitives.remove(oceanShell);
    }
  };
}
