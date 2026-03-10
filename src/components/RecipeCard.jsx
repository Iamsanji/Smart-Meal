import { useState } from "react";

function RecipeCard({ recipe, isFav, onToggleFav, onOpen, onAddToPlan, days, mealTypes }) {
  const [showPlanMenu, setShowPlanMenu] = useState(false);

  return (
    <div className="group relative">
      {/* Card */}
      <div
        className="cursor-pointer"
        onClick={onOpen}
      >
        <div className="aspect-square overflow-hidden rounded-xl bg-neutral-100 dark:bg-neutral-800">
          <img
            src={recipe.strMealThumb}
            alt={recipe.strMeal}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        </div>
        <div className="mt-2 px-0.5">
          <h3 className="text-xs font-medium text-neutral-900 dark:text-neutral-100 line-clamp-1 leading-tight">
            {recipe.strMeal}
          </h3>
          <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-0.5 line-clamp-1">
            {[recipe.strCategory, recipe.strArea].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>

      {/* Actions — top right on hover */}
      <div className="absolute top-2 right-2 flex gap-1.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => { e.stopPropagation(); onToggleFav(); }}
          className={`w-7 h-7 rounded-full flex items-center justify-center text-xs transition-all ${
            isFav
              ? "bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900"
              : "bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm text-neutral-500 dark:text-neutral-300 hover:bg-white dark:hover:bg-neutral-700"
          }`}
        >
          {isFav ? "♥" : "♡"}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); setShowPlanMenu(!showPlanMenu); }}
          className="w-7 h-7 rounded-full bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm text-neutral-500 dark:text-neutral-300 hover:bg-white dark:hover:bg-neutral-700 flex items-center justify-center text-xs transition-all"
        >
          +
        </button>
      </div>

      {/* Fav dot (always visible if fav) */}
      {isFav && (
        <div className="absolute top-2 right-2 hidden sm:block sm:group-hover:hidden transition-opacity">
          <div className="w-2 h-2 bg-neutral-900 dark:bg-neutral-100 rounded-full" />
        </div>
      )}

      {/* Plan dropdown */}
      {showPlanMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowPlanMenu(false)} />
          <div
            className="absolute top-10 right-2 bg-white dark:bg-neutral-800 rounded-lg shadow-lg border border-neutral-200 dark:border-neutral-700 z-50 py-1 min-w-[180px] max-h-64 overflow-y-auto animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-3 py-1.5 border-b border-neutral-100 dark:border-neutral-700">
              <p className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">Add to plan</p>
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
  );
}

export default RecipeCard;