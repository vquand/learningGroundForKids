import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
import { useRef, useState, type CSSProperties, type DragEvent } from "react";
import { getCookingIngredient, getPlacementIngredientIds, type CookingPlacementPhase, type CookingRecipe } from "./cookingConfig";
import { getCookingSquareCounts, type CookingEffect, type CookingGameState } from "./cookingGame";

interface CookingPanProps {
  recipe: CookingRecipe;
  game: CookingGameState;
  phase: CookingPlacementPhase | undefined;
  selectedIngredientId: string | null;
  actionTargetIngredientId?: string;
  selectedActionPieceId: string | null;
  flippingPieceId: string | null;
  onPlace: (ingredientId: string, x: number, y: number) => void;
  onMove: (pieceId: string, x: number, y: number) => void;
  onRemove: (pieceId: string) => void;
  onSelectActionPiece: (pieceId: string) => void;
  onFlipAnimationEnd: () => void;
}

function effectBounds(effect: CookingEffect) {
  const coordinates = effect.cells.map((cell) => cell.split(":").map(Number));
  const xs = coordinates.map(([x]) => x ?? 0);
  const ys = coordinates.map(([, y]) => y ?? 0);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return {
    x: minX,
    y: minY,
    width: Math.max(...xs) - minX + 1,
    height: Math.max(...ys) - minY + 1,
  };
}

function shapeCells(width: number, height: number) {
  return Array.from({ length: width * height }, (_, index) => [
    index % width,
    Math.floor(index / width),
  ] as const);
}

function titleCase(value: string) {
  return value.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function CookingPan({
  recipe,
  game,
  phase,
  selectedIngredientId,
  actionTargetIngredientId,
  selectedActionPieceId,
  flippingPieceId,
  onPlace,
  onMove,
  onRemove,
  onSelectActionPiece,
  onFlipAnimationEnd,
}: CookingPanProps) {
  useUiLanguage();
  const lastDragAtRef = useRef(0);
  const draggingPieceIdRef = useRef<string | null>(null);
  const [dragPreview, setDragPreview] = useState<{
    pieceId: string;
    sourceX: number;
    sourceY: number;
    targetX: number;
    targetY: number;
  } | null>(null);
  const excludedCells = new Set(recipe.station.excludedCells);
  const cells = Array.from({ length: recipe.station.rows * recipe.station.columns });
  const squareCounts = getCookingSquareCounts(game);
  const legendRows = [
    ...recipe.ingredients.map((ingredient) => ({
      id: `ingredient-${ingredient.id}`,
      label: ingredient.label,
      imagePath: ingredient.imagePath,
      count: squareCounts.get(ingredient.id) ?? 0,
    })),
    ...game.effects.map((effect) => ({
      id: `effect-${effect.id}`,
      label: titleCase(effect.id),
      imagePath: undefined,
      count: squareCounts.get(effect.id) ?? 0,
    })),
  ];

  function placeAt(x: number, y: number, ingredientId = selectedIngredientId) {
    if (ingredientId) onPlace(ingredientId, x, y);
  }

  function handleDrop(event: DragEvent<HTMLButtonElement>, x: number, y: number) {
    event.preventDefault();
    const plainData = event.dataTransfer.getData("text/plain");
    const pieceId = event.dataTransfer.getData("application/x-cooking-piece")
      || (plainData.startsWith("cooking-piece:") ? plainData.slice("cooking-piece:".length) : "");
    if (pieceId) onMove(pieceId, x, y);
    else placeAt(x, y, plainData || selectedIngredientId);
    draggingPieceIdRef.current = null;
    setDragPreview(null);
  }

  return (
    <div className={`cooking-pan-stage cooking-pan-stage--${recipe.station.kind}`}>
      <div className={`cooking-pan-wrap cooking-pan-wrap--${recipe.station.kind}`}>
      <img className="cooking-pan-art" src={recipe.station.imagePath} alt="" aria-hidden="true" />
      <div
        className="cooking-pan-grid"
        style={{
          "--pan-columns": recipe.station.columns,
          "--pan-rows": recipe.station.rows,
        } as CSSProperties}
        role="grid"
        aria-label={`${recipe.station.kind} placement grid`}
      >
        {cells.map((_, index) => {
          const x = index % recipe.station.columns;
          const y = Math.floor(index / recipe.station.columns);
          const excluded = excludedCells.has(`${x}:${y}`);
          return (
            <button
              type="button"
              role="gridcell"
              key={`${x}:${y}`}
              className={`cooking-pan-cell${excluded ? " cooking-pan-cell--outside" : ""}`}
              disabled={excluded || !phase}
              style={{ gridColumn: x + 1, gridRow: y + 1 }}
              aria-label={excluded ? `Outside pan, row ${y + 1}, column ${x + 1}` : `Place at row ${y + 1}, column ${x + 1}`}
              onClick={() => placeAt(x, y)}
              onDragOver={(event) => {
                if (!excluded && phase) {
                  event.preventDefault();
                  const draggingPiece = game.pieces.find((piece) => piece.id === draggingPieceIdRef.current);
                  if (draggingPiece) {
                    setDragPreview((current) => current
                      && current.pieceId === draggingPiece.id
                      && current.targetX === x
                      && current.targetY === y
                      ? current
                      : {
                        pieceId: draggingPiece.id,
                        sourceX: draggingPiece.x,
                        sourceY: draggingPiece.y,
                        targetX: x,
                        targetY: y,
                      });
                  }
                }
              }}
              onDrop={(event) => handleDrop(event, x, y)}
            />
          );
        })}

        {dragPreview && (() => {
          const piece = game.pieces.find((candidate) => candidate.id === dragPreview.pieceId);
          const ingredient = piece ? getCookingIngredient(recipe, piece.ingredientId) : undefined;
          if (!piece || !ingredient) return null;
          const shape = ingredient.shapes?.find((candidate) => candidate.id === piece.shapeId) ?? {
            width: piece.width,
            height: piece.height,
            cells: shapeCells(piece.width, piece.height),
          };
          const renderSilhouette = (x: number, y: number, kind: "source" | "target") => (
            <span
              className={`cooking-pan-drag-preview cooking-pan-drag-preview--${kind}`}
              key={`${kind}-${piece.id}`}
              style={{
                gridColumn: `${x + 1} / span ${shape.width}`,
                gridRow: `${y + 1} / span ${shape.height}`,
              }}
              aria-hidden="true"
            >
              <span
                className="cooking-pan-drag-preview__cells"
                style={{
                  gridTemplateColumns: `repeat(${shape.width}, minmax(0, 1fr))`,
                  gridTemplateRows: `repeat(${shape.height}, minmax(0, 1fr))`,
                }}
              >
                {shape.cells.map(([cellX, cellY]) => (
                  <span
                    className="cooking-pan-drag-preview__cell"
                    key={`${cellX}:${cellY}`}
                    style={{ gridColumn: cellX + 1, gridRow: cellY + 1 }}
                  />
                ))}
              </span>
            </span>
          );
          return (
            <>
              {renderSilhouette(dragPreview.sourceX, dragPreview.sourceY, "source")}
              {renderSilhouette(dragPreview.targetX, dragPreview.targetY, "target")}
            </>
          );
        })()}

        {game.effects.map((effect) => {
          const bounds = effectBounds(effect);
          return (
            <span
              className="cooking-pan-effect"
              key={`${effect.id}-${effect.cells.join("-")}`}
              style={{
                gridColumn: `${bounds.x + 1} / span ${bounds.width}`,
                gridRow: `${bounds.y + 1} / span ${bounds.height}`,
              }}
              aria-hidden="true"
            >
              <img src={recipe.station.effectImagePath} alt="" />
            </span>
          );
        })}

        {game.pieces.map((piece) => {
          const ingredient = getCookingIngredient(recipe, piece.ingredientId);
          if (!ingredient) return null;
          const removable = Boolean(phase && getPlacementIngredientIds(phase).includes(piece.ingredientId));
          const actionSelectable = actionTargetIngredientId === piece.ingredientId;
          const actionSelected = selectedActionPieceId === piece.id;
          const flipping = flippingPieceId === piece.id && Boolean(ingredient.cookedImagePath);
          const shape = ingredient.shapes?.find((candidate) => candidate.id === piece.shapeId);
          const renderTiles = ingredient.renderMode === "tiles" && shape;
          return (
            <button
              type="button"
              className={`cooking-pan-piece cooking-pan-piece--${piece.layer} cooking-pan-piece--${piece.ingredientId}${actionSelected ? " cooking-pan-piece--action-selected" : ""}${flipping ? " cooking-pan-piece--flipping" : ""}`}
              draggable={removable}
              key={piece.id}
              style={{
                gridColumn: `${piece.x + 1} / span ${piece.width}`,
                gridRow: `${piece.y + 1} / span ${piece.height}`,
              }}
              onClick={() => {
                if (Date.now() - lastDragAtRef.current < 500) return;
                if (removable) onRemove(piece.id);
                else if (actionSelectable) onSelectActionPiece(piece.id);
              }}
              onDragStart={(event) => {
                if (!removable) return;
                lastDragAtRef.current = Date.now();
                draggingPieceIdRef.current = piece.id;
                setDragPreview({
                  pieceId: piece.id,
                  sourceX: piece.x,
                  sourceY: piece.y,
                  targetX: piece.x,
                  targetY: piece.y,
                });
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("application/x-cooking-piece", piece.id);
                event.dataTransfer.setData("text/plain", `cooking-piece:${piece.id}`);
              }}
              onDragEnd={() => {
                draggingPieceIdRef.current = null;
                setDragPreview(null);
              }}
              disabled={!removable && !actionSelectable}
              aria-pressed={actionSelectable ? actionSelected : undefined}
              aria-label={removable
                ? `Drag to reposition or click to remove ${uiText(ingredient.label)}`
                : actionSelectable
                  ? `${actionSelected ? uiText("Selected") : uiText("Select")} ${uiText(ingredient.label)} to flip`
                  : `${uiText(ingredient.label)} in ${recipe.station.kind}`}
            >
              {renderTiles ? (
                <span
                  className="cooking-pan-piece__tiles"
                  style={{
                    gridTemplateColumns: `repeat(${shape.width}, minmax(0, 1fr))`,
                    gridTemplateRows: `repeat(${shape.height}, minmax(0, 1fr))`,
                  }}
                  aria-hidden="true"
                >
                  {shape.cells.map(([x, y]) => (
                    <span
                      className="cooking-pan-piece__tile"
                      key={`${x}:${y}`}
                      style={{ gridColumn: x + 1, gridRow: y + 1 }}
                    >
                      <img src={ingredient.imagePath} alt="" />
                    </span>
                  ))}
                </span>
              ) : (
                <span className="cooking-pan-piece__art" aria-hidden="true">
                  <img
                    className={flipping ? "cooking-pan-piece__raw cooking-pan-piece__raw--flipping" : "cooking-pan-piece__raw"}
                    src={ingredient.imagePath}
                    alt=""
                  />
                  {flipping && ingredient.cookedImagePath && (
                    <img
                      className="cooking-pan-piece__cooked cooking-pan-piece__cooked--flipping"
                      src={ingredient.cookedImagePath}
                      alt=""
                      onAnimationEnd={onFlipAnimationEnd}
                      onError={onFlipAnimationEnd}
                    />
                  )}
                </span>
              )}
            </button>
          );
        })}
      </div>
      </div>
      <aside className="cooking-pan-legend" aria-label={`${recipe.station.kind} contents`}>
        <p className="cooking-kicker">{uiText("Contents")}</p>
        <ul>
          {legendRows.map((row) => (
            <li key={row.id} aria-label={`${uiText(row.label)}: ${row.count} grid squares`}>
              <span className="cooking-pan-legend__swatch" aria-hidden="true">
                {row.imagePath ? <img src={row.imagePath} alt="" /> : <span className="cooking-pan-legend__effect" />}
              </span>
              <span className="cooking-pan-legend__label">{uiText(row.label)}</span>
              <strong>{row.count}</strong>
              <small>{uiText("sq")}</small>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
