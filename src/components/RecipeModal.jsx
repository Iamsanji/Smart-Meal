import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";

function RecipeModal({ recipe, isFav, onToggleFav, onClose, onAddToPlan, days, mealTypes }) {
  const [showPlanMenu, setShowPlanMenu] = useState(false);
  const [activeTab, setActiveTab] = useState('ingredients');
  const modalRef = useRef(null);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const ingredients = [];
  for (let i = 1; i <= 20; i++) {
    const ingredient = recipe[`strIngredient${i}`];
    const measure = recipe[`strMeasure${i}`];
    if (ingredient && ingredient.trim()) {
      ingredients.push({ name: ingredient.trim(), measure: measure ? measure.trim() : '' });
    }
  }

  const instructions = recipe.strInstructions
    ? recipe.strInstructions
        .split(/\r\n|\n|\r/)
        .filter(step => step.trim().length > 0)
        .map(step => step.replace(/^\d+\.\s*/, '').trim())
    : [];

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 animate-fadeIn"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        className="bg-white dark:bg-neutral-900 w-full sm:max-w-lg sm:rounded-2xl max-h-[95vh] sm:max-h-[85vh] overflow-hidden relative animate-slideUp flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Image */}
        <div className="relative h-52 sm:h-56 bg-neutral-100 dark:bg-neutral-800 flex-shrink-0">
          <img
            src={recipe.strMealThumb}
            alt={recipe.strMeal}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

          {/* Close */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 bg-black/20 hover:bg-black/40 backdrop-blur-sm rounded-full flex items-center justify-center text-white text-sm transition-colors"
            aria-label="Close"
          >
            ✕
          </button>

          {/* Title */}
          <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
            <h2 className="text-lg font-semibold leading-tight">{recipe.strMeal}</h2>
            <p className="text-xs text-white/70 mt-1">
              {[recipe.strCategory, recipe.strArea].filter(Boolean).join(" · ")}
              {ingredients.length > 0 && ` · ${ingredients.length} ingredients`}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-neutral-100 dark:border-neutral-800 px-4 flex-shrink-0">
          {['ingredients', 'instructions'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-3 mr-6 text-xs font-medium border-b-2 transition-colors capitalize cursor-pointer ${
                activeTab === tab
                  ? 'border-neutral-900 dark:border-neutral-100 text-neutral-900 dark:text-neutral-100'
                  : 'border-transparent text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Tags */}
          {recipe.strTags && (
            <div className="flex gap-1.5 flex-wrap mb-4">
              {recipe.strTags.split(',').map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 rounded text-[10px] font-medium"
                >
                  {tag.trim()}
                </span>
              ))}
            </div>
          )}

          {activeTab === 'ingredients' && ingredients.length > 0 && (
            <div className="space-y-1 animate-fadeIn">
              {ingredients.map((ing, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-2 border-b border-neutral-50 dark:border-neutral-800 last:border-0"
                >
                  <span className="text-sm text-neutral-800 dark:text-neutral-200">{ing.name}</span>
                  <span className="text-xs text-neutral-400 dark:text-neutral-500 ml-3 flex-shrink-0">{ing.measure}</span>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'instructions' && instructions.length > 0 && (
            <div className="space-y-4 animate-fadeIn">
              {instructions.map((step, i) => (
                <div key={i} className="flex gap-3">
                  <span className="text-[10px] font-semibold text-neutral-300 dark:text-neutral-600 mt-0.5 w-4 flex-shrink-0 text-right">
                    {i + 1}
                  </span>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">{step}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="border-t border-neutral-100 dark:border-neutral-800 p-4 flex gap-2 items-center flex-shrink-0 flex-wrap">
          <button
            onClick={onToggleFav}
            className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
              isFav
                ? 'bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
            }`}
          >
            {isFav ? '♥ Saved' : '♡ Save'}
          </button>

          <div className="relative">
            <button
              onClick={() => setShowPlanMenu(!showPlanMenu)}
              className="px-3 py-2 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg text-xs font-medium transition-colors"
            >
              + Plan
            </button>

            {showPlanMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowPlanMenu(false)} />
                <div className="absolute bottom-10 left-0 bg-white dark:bg-neutral-800 rounded-lg shadow-lg border border-neutral-200 dark:border-neutral-700 z-50 py-1 min-w-[180px] max-h-64 overflow-y-auto animate-scaleIn">
                  <div className="px-3 py-1.5 border-b border-neutral-100 dark:border-neutral-700">
                    <p className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">Select time</p>
                  </div>
                  {days.map((day) =>
                    mealTypes.map((type) => (
                      <button
                        key={`${day}-${type}`}
                        onClick={() => { onAddToPlan(recipe, day, type); setShowPlanMenu(false); }}
                        className="w-full px-3 py-1.5 text-left hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
                      >
                        <span className="text-xs text-neutral-600 dark:text-neutral-300">
                          <span className="font-medium text-neutral-800 dark:text-neutral-200">{day}</span>
                          <span className="text-neutral-300 dark:text-neutral-600 mx-1">·</span>
                          {type}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>

          {recipe.strYoutube && (
            <button
              onClick={() => {
                import('@tauri-apps/plugin-shell').then(({ open }) => open(recipe.strYoutube));
              }}
              className="px-3 py-2 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg text-xs font-medium transition-colors ml-auto cursor-pointer"
            >
              ▶ Video
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default RecipeModal;