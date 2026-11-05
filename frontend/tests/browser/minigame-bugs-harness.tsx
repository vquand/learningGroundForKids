import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { CookingPage } from "../../src/features/cooking/CookingPage";
import { FoodAndDrinkPage } from "../../src/features/food-and-drink/FoodAndDrinkPage";
import "../../src/app.css";
import { CupPreview } from "../../src/features/food-and-drink/CupPreview";
import { FOOD_AND_DRINK_CUP_OPTIONS, FOOD_AND_DRINK_RECIPES } from "../../src/features/food-and-drink/foodAndDrinkConfig";
const scene = new URLSearchParams(location.search).get("scene") ?? "steak";
createRoot(document.getElementById("root")!).render(
  scene === "cups" ? <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 12rem)", gap: "2rem", padding: "2rem" }}>
    {FOOD_AND_DRINK_RECIPES.flatMap((recipe) => FOOD_AND_DRINK_CUP_OPTIONS.map((cup) => <div key={`${recipe.id}-${cup.id}`}>
      <CupPreview recipe={recipe} cup={cup} fillLevel={1} addedIngredientIds={recipe.ingredients.map((ingredient) => ingredient.id)} />
      <p>{recipe.title}: {cup.label}</p>
    </div>))}
  </div> : <MemoryRouter initialEntries={[scene === "drink" ? "/uat/food-and-drink/lemonade" : `/uat/cooking/${scene}`]}>
    <Routes><Route path="/uat/cooking/:mealId" element={<CookingPage />} /><Route path="/uat/food-and-drink/:recipeId" element={<FoodAndDrinkPage />} /></Routes>
  </MemoryRouter>,
);
