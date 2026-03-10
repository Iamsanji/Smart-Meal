import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import RecipeCard from "./components/RecipeCard";
import MealPlan from "./components/MealPlan";
import RecipeModal from "./components/RecipeModal";
import ShoppingList from "./components/ShoppingList";
import BudgetMeals from "./components/BudgetMeals";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MEAL_TYPES = ["Breakfast", "Lunch", "Dinner"];

function App() {
  const [activeTab, setActiveTab] = useState("search");
  const [query, setQuery] = useState("");
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [areas, setAreas] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedArea, setSelectedArea] = useState("");
  const [favorites, setFavorites] = useState([]);
  const [mealPlan, setMealPlan] = useState({});
  const [templates, setTemplates] = useState([]);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') === 'true');
  const [searchMode, setSearchMode] = useState('name');
  const [searchHistory, setSearchHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem('searchHistory') || '[]'); } catch { return []; }
  });
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('darkMode', darkMode);
  }, [darkMode]);

  useEffect(() => {
    loadSavedData();
    loadFilters();
  }, []);

  // Auto-search: debounce query, instant on filter change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (searchMode === 'ingredient' && query.trim()) {
        doIngredientSearch(query);
      } else if (query.trim() || selectedCategory || selectedArea) {
        doSearch(query, selectedCategory, selectedArea);
      }
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [query, selectedCategory, selectedArea, searchMode]);

  async function doSearch(q, cat, area) {
    setLoading(true);
    setShowSuggestions(false);
    if (q.trim()) addToHistory(q.trim());
    try {
      const result = await invoke("search_recipes", {
        query: q,
        category: cat,
        area: area,
      });
      setRecipes(JSON.parse(result));
    } catch {
      setRecipes([]);
    }
    setLoading(false);
  }

  async function doIngredientSearch(q) {
    setLoading(true);
    setShowSuggestions(false);
    if (q.trim()) addToHistory(q.trim());
    try {
      const result = await invoke("search_by_ingredient", { ingredient: q });
      setRecipes(JSON.parse(result));
    } catch {
      setRecipes([]);
    }
    setLoading(false);
  }

  async function loadSavedData() {
    try {
      const favs = await invoke("load_favorites");
      setFavorites(JSON.parse(favs));
    } catch {
      setFavorites([]);
    }
    try {
      const plan = await invoke("load_meal_plan");
      setMealPlan(JSON.parse(plan));
    } catch {
      setMealPlan({});
    }
    try {
      const tpl = await invoke("load_templates");
      setTemplates(JSON.parse(tpl));
    } catch {
      setTemplates([]);
    }
  }

  async function loadFilters() {
    try {
      const cats = await invoke("fetch_categories");
      setCategories(JSON.parse(cats));
    } catch {
      setCategories([]);
    }
    try {
      const ar = await invoke("fetch_areas");
      setAreas(JSON.parse(ar));
    } catch {
      setAreas([]);
    }
  }

  async function saveFavorites(newFavs) {
    setFavorites(newFavs);
    try {
      await invoke("save_favorites", { data: JSON.stringify(newFavs) });
    } catch (e) {
      console.error("Failed to save favorites:", e);
    }
  }

  async function saveMealPlan(newPlan) {
    setMealPlan(newPlan);
    try {
      await invoke("save_meal_plan", { data: JSON.stringify(newPlan) });
    } catch (e) {
      console.error("Failed to save meal plan:", e);
    }
  }

  async function getRandomRecipe() {
    setLoading(true);
    try {
      const result = await invoke("random_recipe");
      const meal = JSON.parse(result);
      setSelectedRecipe(meal);
      setModalOpen(true);
    } catch (e) {
      console.error("Random recipe failed:", e);
    }
    setLoading(false);
  }

  async function openRecipeDetail(idMeal) {
    try {
      const result = await invoke("get_recipe_detail", { id: idMeal });
      setSelectedRecipe(JSON.parse(result));
      setModalOpen(true);
    } catch (e) {
      console.error("Failed to load recipe:", e);
    }
  }

  function toggleFavorite(recipe) {
    const exists = favorites.find((f) => f.idMeal === recipe.idMeal);
    if (exists) {
      saveFavorites(favorites.filter((f) => f.idMeal !== recipe.idMeal));
    } else {
      saveFavorites([...favorites, recipe]);
    }
  }

  function isFavorite(idMeal) {
    return favorites.some((f) => f.idMeal === idMeal);
  }

  function addToMealPlan(recipe, day, mealType) {
    const key = `${day}-${mealType}`;
    const newPlan = { ...mealPlan, [key]: { idMeal: recipe.idMeal, strMeal: recipe.strMeal, strMealThumb: recipe.strMealThumb } };
    saveMealPlan(newPlan);
  }

  function removeFromMealPlan(day, mealType) {
    const key = `${day}-${mealType}`;
    const newPlan = { ...mealPlan };
    delete newPlan[key];
    saveMealPlan(newPlan);
  }

  function clearMealPlan() {
    saveMealPlan({});
  }

  function addToHistory(term) {
    const filtered = searchHistory.filter(h => h.toLowerCase() !== term.toLowerCase());
    const updated = [term, ...filtered].slice(0, 20);
    setSearchHistory(updated);
    localStorage.setItem('searchHistory', JSON.stringify(updated));
  }

  function removeFromHistory(term) {
    const updated = searchHistory.filter(h => h !== term);
    setSearchHistory(updated);
    localStorage.setItem('searchHistory', JSON.stringify(updated));
  }

  function clearHistory() {
    setSearchHistory([]);
    localStorage.removeItem('searchHistory');
  }

  async function saveTemplate(name) {
    const newTemplate = { id: Date.now().toString(), name, plan: { ...mealPlan } };
    const updated = [...templates, newTemplate];
    setTemplates(updated);
    try {
      await invoke("save_templates", { data: JSON.stringify(updated) });
    } catch (e) {
      console.error("Failed to save templates:", e);
    }
  }

  function applyTemplate(template) {
    saveMealPlan({ ...template.plan });
  }

  async function deleteTemplate(id) {
    const updated = templates.filter(t => t.id !== id);
    setTemplates(updated);
    try {
      await invoke("save_templates", { data: JSON.stringify(updated) });
    } catch (e) {
      console.error("Failed to save templates:", e);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">
        <div className="px-4 sm:px-6 flex items-center justify-between h-14">
          <h1 className="text-base font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">SmartMeal</h1>
          <div className="flex items-center gap-3">
            <button
              onClick={getRandomRecipe}
              className="text-xs text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors cursor-pointer"
            >
              Surprise me
            </button>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors cursor-pointer text-sm"
            >
              {darkMode ? '☀' : '☾'}
            </button>
          </div>
        </div>
        {/* Tab bar */}
        <div className="px-3 sm:px-6 flex gap-3 sm:gap-6 border-t border-neutral-100 dark:border-neutral-800 overflow-x-auto">
          {[
            { id: "search", label: "Search" },
            { id: "planner", label: "Plan" },
            { id: "budget", label: "Budget" },
            { id: "shopping", label: "Shop" },
            { id: "favorites", label: "Favorites" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-3 text-xs sm:text-sm font-medium border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === tab.id
                  ? "border-neutral-900 dark:border-neutral-100 text-neutral-900 dark:text-neutral-100"
                  : "border-transparent text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1 px-4 sm:px-6 py-4 max-w-5xl w-full mx-auto">
        {/* Search Tab */}
        {activeTab === "search" && (
          <section className="animate-fadeIn">
            {/* Search input */}
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                placeholder={searchMode === 'ingredient' ? "Search by ingredient..." : "Search recipes..."}
                className="w-full px-3 py-2.5 bg-neutral-100 dark:bg-neutral-800 rounded-xl text-sm outline-none placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:bg-white dark:focus:bg-neutral-900 focus:ring-1 focus:ring-neutral-300 dark:focus:ring-neutral-600 transition-all dark:text-neutral-100"
              />

              {/* Search suggestions dropdown */}
              {showSuggestions && !query && searchHistory.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-lg z-20 overflow-hidden animate-scaleIn">
                  <div className="px-3 py-2 border-b border-neutral-100 dark:border-neutral-700 flex items-center justify-between">
                    <p className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">Recent</p>
                    <button
                      onMouseDown={(e) => { e.preventDefault(); clearHistory(); }}
                      className="text-[10px] text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300 cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                  {searchHistory.slice(0, 8).map((term) => (
                    <div key={term} className="flex items-center group">
                      <button
                        onMouseDown={(e) => { e.preventDefault(); setQuery(term); setShowSuggestions(false); }}
                        className="flex-1 px-3 py-2 text-left text-xs text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors cursor-pointer truncate"
                      >
                        {term}
                      </button>
                      <button
                        onMouseDown={(e) => { e.preventDefault(); removeFromHistory(term); }}
                        className="px-2 text-neutral-300 dark:text-neutral-600 hover:text-neutral-500 dark:hover:text-neutral-400 opacity-0 group-hover:opacity-100 text-[10px] cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Search mode + Filters */}
            <div className="flex gap-2 mt-3 overflow-x-auto pb-1 items-center">
              <div className="flex gap-1 flex-shrink-0">
                <button
                  onClick={() => { setSearchMode('name'); setRecipes([]); }}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                    searchMode === 'name'
                      ? 'bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'
                  }`}
                >
                  By Name
                </button>
                <button
                  onClick={() => { setSearchMode('ingredient'); setSelectedCategory(""); setSelectedArea(""); setRecipes([]); }}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                    searchMode === 'ingredient'
                      ? 'bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'
                  }`}
                >
                  By Ingredient
                </button>
              </div>
              {searchMode === 'name' && (
                <>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="px-3 py-2 bg-neutral-100 dark:bg-neutral-800 rounded-lg text-xs text-neutral-600 dark:text-neutral-300 outline-none cursor-pointer min-w-fit"
                  >
                    <option value="">Category</option>
                    {categories.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <select
                    value={selectedArea}
                    onChange={(e) => setSelectedArea(e.target.value)}
                    className="px-3 py-2 bg-neutral-100 dark:bg-neutral-800 rounded-lg text-xs text-neutral-600 dark:text-neutral-300 outline-none cursor-pointer min-w-fit"
                  >
                    <option value="">Cuisine</option>
                    {areas.map((a) => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                  {(selectedCategory || selectedArea) && (
                    <button
                      onClick={() => { setSelectedCategory(""); setSelectedArea(""); }}
                      className="px-3 py-2 text-xs text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      Clear filters
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Results */}
            <div className="mt-5">
              {loading ? (
                <div className="text-center text-neutral-400 dark:text-neutral-500 py-16 loading-spinner text-sm">Loading</div>
              ) : recipes.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                  {recipes.map((r) => (
                    <RecipeCard
                      key={r.idMeal}
                      recipe={r}
                      isFav={isFavorite(r.idMeal)}
                      onToggleFav={() => toggleFavorite(r)}
                      onOpen={() => openRecipeDetail(r.idMeal)}
                      onAddToPlan={addToMealPlan}
                      days={DAYS}
                      mealTypes={MEAL_TYPES}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-20">
                  <p className="text-neutral-300 dark:text-neutral-600 text-sm">
                    {query || selectedCategory || selectedArea
                      ? "No recipes found"
                      : "Start typing to search"}
                  </p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Planner Tab */}
        {activeTab === "planner" && (
          <MealPlan
            days={DAYS}
            mealTypes={MEAL_TYPES}
            mealPlan={mealPlan}
            onRemove={removeFromMealPlan}
            onClear={clearMealPlan}
            templates={templates}
            onSaveTemplate={saveTemplate}
            onApplyTemplate={applyTemplate}
            onDeleteTemplate={deleteTemplate}
          />
        )}

        {/* Budget Tab */}
        {activeTab === "budget" && (
          <BudgetMeals
            onOpen={openRecipeDetail}
            onAddToPlan={addToMealPlan}
            onToggleFav={toggleFavorite}
            isFavorite={isFavorite}
            days={DAYS}
            mealTypes={MEAL_TYPES}
          />
        )}

        {/* Shopping Tab */}
        {activeTab === "shopping" && (
          <ShoppingList mealPlan={mealPlan} />
        )}

        {/* Favorites Tab */}
        {activeTab === "favorites" && (
          <section className="animate-fadeIn">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Favorites</h2>
              {favorites.length > 0 && (
                <span className="text-xs text-neutral-400 dark:text-neutral-500">{favorites.length}</span>
              )}
            </div>
            {favorites.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                {favorites.map((r) => (
                  <RecipeCard
                    key={r.idMeal}
                    recipe={r}
                    isFav={true}
                    onToggleFav={() => toggleFavorite(r)}
                    onOpen={() => openRecipeDetail(r.idMeal)}
                    onAddToPlan={addToMealPlan}
                    days={DAYS}
                    mealTypes={MEAL_TYPES}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-20">
                <p className="text-neutral-300 dark:text-neutral-600 text-sm">No favorites yet</p>
              </div>
            )}
          </section>
        )}

        {/* Modal */}
        {modalOpen && selectedRecipe && (
          <RecipeModal
            recipe={selectedRecipe}
            isFav={isFavorite(selectedRecipe.idMeal)}
            onToggleFav={() => toggleFavorite(selectedRecipe)}
            onClose={() => setModalOpen(false)}
            onAddToPlan={addToMealPlan}
            days={DAYS}
            mealTypes={MEAL_TYPES}
          />
        )}
      </main>
    </div>
  );
}

export default App;
