import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

function ShoppingList({ mealPlan }) {
  const [ingredients, setIngredients] = useState([]);
  const [checked, setChecked] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    generateList();
  }, [mealPlan]);

  async function generateList() {
    const mealIds = [...new Set(Object.values(mealPlan).filter(Boolean).map(m => m.idMeal))];
    if (mealIds.length === 0) {
      setIngredients([]);
      return;
    }

    setLoading(true);
    const allIngredients = {};

    for (const id of mealIds) {
      try {
        const result = await invoke('get_recipe_detail', { id });
        const recipe = JSON.parse(result);
        for (let i = 1; i <= 20; i++) {
          const name = recipe[`strIngredient${i}`];
          const measure = recipe[`strMeasure${i}`];
          if (name && name.trim()) {
            const key = name.trim().toLowerCase();
            if (!allIngredients[key]) {
              allIngredients[key] = { name: name.trim(), measures: [], category: categorizeIngredient(key) };
            }
            if (measure && measure.trim()) {
              allIngredients[key].measures.push(measure.trim());
            }
          }
        }
      } catch {
        // skip failed fetches
      }
    }

    const sorted = Object.values(allIngredients).sort((a, b) => {
      if (a.category !== b.category) return a.category.localeCompare(b.category);
      return a.name.localeCompare(b.name);
    });

    setIngredients(sorted);
    setLoading(false);
  }

  function categorizeIngredient(name) {
    if (/chicken|beef|pork|lamb|turkey|bacon|sausage|mince|steak/.test(name)) return 'Meat';
    if (/salmon|tuna|fish|cod|prawn|shrimp|crab/.test(name)) return 'Seafood';
    if (/milk|cream|cheese|butter|yogurt|yoghurt|egg/.test(name)) return 'Dairy & Eggs';
    if (/rice|pasta|noodle|bread|flour|spaghetti|penne|tortilla|oat/.test(name)) return 'Grains';
    if (/tomato|onion|garlic|pepper|carrot|potato|mushroom|spinach|broccoli|pea|bean|celery|lettuce|cabbage|corn|courgette|zucchini|aubergine|eggplant|leek/.test(name)) return 'Vegetables';
    if (/apple|banana|lemon|lime|orange|berry|mango/.test(name)) return 'Fruits';
    if (/salt|pepper|cumin|paprika|cinnamon|oregano|basil|thyme|parsley|chili|ginger|turmeric|coriander|mint|bay|nutmeg|rosemary/.test(name)) return 'Herbs & Spices';
    if (/oil|olive|vinegar|sauce|soy|ketchup|mustard|worcestershire/.test(name)) return 'Oils & Sauces';
    if (/sugar|honey|syrup|chocolate|cocoa|vanilla/.test(name)) return 'Baking';
    if (/stock|broth|water|coconut milk|coconut cream/.test(name)) return 'Liquids';
    if (/nut|almond|walnut|peanut|cashew|sesame/.test(name)) return 'Nuts & Seeds';
    return 'Other';
  }

  function toggleCheck(name) {
    setChecked(prev => ({ ...prev, [name]: !prev[name] }));
  }

  function clearChecked() {
    setChecked({});
  }

  const checkedCount = Object.values(checked).filter(Boolean).length;
  const grouped = {};
  ingredients.forEach(ing => {
    if (!grouped[ing.category]) grouped[ing.category] = [];
    grouped[ing.category].push(ing);
  });

  return (
    <section className="animate-fadeIn">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Shopping List</h2>
          {ingredients.length > 0 && (
            <span className="text-xs text-neutral-400 dark:text-neutral-500">
              {checkedCount}/{ingredients.length}
            </span>
          )}
        </div>
        {checkedCount > 0 && (
          <button
            onClick={clearChecked}
            className="text-xs text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors cursor-pointer"
          >
            Uncheck all
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center text-neutral-400 dark:text-neutral-500 py-16 loading-spinner text-sm">Generating</div>
      ) : ingredients.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-neutral-300 dark:text-neutral-600 text-sm">Add meals to your plan to generate a shopping list</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Progress bar */}
          {ingredients.length > 0 && (
            <div className="h-1 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-neutral-900 dark:bg-neutral-100 rounded-full transition-all duration-300"
                style={{ width: `${(checkedCount / ingredients.length) * 100}%` }}
              />
            </div>
          )}

          {Object.entries(grouped).map(([category, items]) => (
            <div key={category}>
              <p className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-2">{category}</p>
              <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden">
                <div className="divide-y divide-neutral-50 dark:divide-neutral-800">
                  {items.map((ing) => {
                    const isChecked = checked[ing.name] || false;
                    return (
                      <button
                        key={ing.name}
                        onClick={() => toggleCheck(ing.name)}
                        className="w-full px-4 py-2.5 flex items-center gap-3 text-left transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800 cursor-pointer"
                      >
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                          isChecked
                            ? 'bg-neutral-900 dark:bg-neutral-100 border-neutral-900 dark:border-neutral-100'
                            : 'border-neutral-300 dark:border-neutral-600'
                        }`}>
                          {isChecked && (
                            <span className="text-white dark:text-neutral-900 text-[8px] font-bold">✓</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-medium transition-colors ${
                            isChecked
                              ? 'text-neutral-300 dark:text-neutral-600 line-through'
                              : 'text-neutral-800 dark:text-neutral-200'
                          }`}>
                            {ing.name}
                          </p>
                        </div>
                        {ing.measures.length > 0 && (
                          <span className={`text-[10px] flex-shrink-0 transition-colors ${
                            isChecked ? 'text-neutral-200 dark:text-neutral-700' : 'text-neutral-400 dark:text-neutral-500'
                          }`}>
                            {[...new Set(ing.measures)].join(', ')}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default ShoppingList;
