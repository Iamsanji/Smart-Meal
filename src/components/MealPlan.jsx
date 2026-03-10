import { useState } from 'react';

function MealPlan({ days, mealTypes, mealPlan, onRemove, onClear, onReorder, templates = [], onSaveTemplate, onApplyTemplate, onDeleteTemplate }) {
  const [draggedItem, setDraggedItem] = useState(null);
  const [dragOverDay, setDragOverDay] = useState(null);
  const [dragOverType, setDragOverType] = useState(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);

  const handleDragStart = (e, day, type, meal) => {
    setDraggedItem({ day, type, meal });
    e.dataTransfer.setData('text/plain', JSON.stringify({ day, type }));
    e.currentTarget.classList.add('opacity-50');
  };

  const handleDragEnd = (e) => {
    e.currentTarget.classList.remove('opacity-50');
    setDraggedItem(null);
    setDragOverDay(null);
    setDragOverType(null);
  };

  const handleDragOver = (e, day, type) => {
    e.preventDefault();
    if (draggedItem && (day !== draggedItem.day || type !== draggedItem.type)) {
      setDragOverDay(day);
      setDragOverType(type);
    }
  };

  const handleDragLeave = () => {
    setDragOverDay(null);
    setDragOverType(null);
  };

  const handleDrop = (e, targetDay, targetType) => {
    e.preventDefault();
    setDragOverDay(null);
    setDragOverType(null);
    if (draggedItem && onReorder) {
      onReorder(draggedItem.day, draggedItem.type, targetDay, targetType);
    }
  };

  const mealCount = Object.values(mealPlan).filter(meal => meal !== null).length;

  return (
    <section className="animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Weekly Plan</h2>
          <span className="text-xs text-neutral-400 dark:text-neutral-500">{mealCount} meals</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowTemplates(!showTemplates)}
            className="text-xs text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors cursor-pointer"
          >
            Templates
          </button>
          {mealCount > 0 && (
            <button
              onClick={onClear}
              className="text-xs text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors cursor-pointer"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* Templates Panel */}
      {showTemplates && (
        <div className="mb-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden animate-scaleIn">
          <div className="px-4 py-2.5 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
            <p className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">Templates</p>
            {mealCount > 0 && (
              <button
                onClick={() => setShowSaveInput(!showSaveInput)}
                className="text-[10px] text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors cursor-pointer"
              >
                {showSaveInput ? 'Cancel' : '+ Save current'}
              </button>
            )}
          </div>

          {showSaveInput && (
            <div className="px-4 py-2.5 border-b border-neutral-100 dark:border-neutral-800 flex gap-2">
              <input
                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Template name..."
                className="flex-1 px-3 py-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-lg text-xs outline-none placeholder:text-neutral-400 dark:placeholder:text-neutral-500 dark:text-neutral-100"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && templateName.trim()) {
                    onSaveTemplate(templateName.trim());
                    setTemplateName('');
                    setShowSaveInput(false);
                  }
                }}
              />
              <button
                onClick={() => {
                  if (templateName.trim()) {
                    onSaveTemplate(templateName.trim());
                    setTemplateName('');
                    setShowSaveInput(false);
                  }
                }}
                className="px-3 py-1.5 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 rounded-lg text-xs font-medium cursor-pointer"
              >
                Save
              </button>
            </div>
          )}

          {templates.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <p className="text-[10px] text-neutral-300 dark:text-neutral-600">No saved templates</p>
            </div>
          ) : (
            <div className="divide-y divide-neutral-50 dark:divide-neutral-800">
              {templates.map((tpl) => {
                const count = Object.values(tpl.plan).filter(Boolean).length;
                return (
                  <div key={tpl.id} className="px-4 py-2.5 flex items-center justify-between group">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-neutral-800 dark:text-neutral-200 truncate">{tpl.name}</p>
                      <p className="text-[10px] text-neutral-400 dark:text-neutral-500">{count} meals</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { onApplyTemplate(tpl); setShowTemplates(false); }}
                        className="px-2.5 py-1 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg text-[10px] font-medium transition-colors cursor-pointer"
                      >
                        Apply
                      </button>
                      <button
                        onClick={() => onDeleteTemplate(tpl.id)}
                        className="text-neutral-300 dark:text-neutral-600 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors opacity-0 group-hover:opacity-100 text-xs cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {mealCount === 0 ? (
        <div className="text-center py-20">
          <p className="text-neutral-300 dark:text-neutral-600 text-sm">No meals planned yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {days.map((day) => {
            const dayMeals = mealTypes.map(type => ({ type, meal: mealPlan[`${day}-${type}`] }));
            const hasMeals = dayMeals.some(m => m.meal);
            if (!hasMeals) return null;

            return (
              <div key={day} className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
                {/* Day header */}
                <div className="px-4 py-2.5 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider">{day}</h3>
                  <span className="text-[10px] text-neutral-300 dark:text-neutral-600">
                    {dayMeals.filter(m => m.meal).length}/{mealTypes.length}
                  </span>
                </div>

                {/* Meals */}
                <div className="divide-y divide-neutral-50 dark:divide-neutral-800">
                  {dayMeals.map(({ type, meal }) => {
                    const isDragOver = dragOverDay === day && dragOverType === type;
                    return (
                      <div
                        key={type}
                        className={`px-4 py-2.5 transition-colors ${isDragOver ? 'bg-neutral-50 dark:bg-neutral-800' : ''}`}
                        onDragOver={(e) => handleDragOver(e, day, type)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, day, type)}
                      >
                        {meal ? (
                          <div
                            draggable
                            onDragStart={(e) => handleDragStart(e, day, type, meal)}
                            onDragEnd={handleDragEnd}
                            className="flex items-center gap-3 group cursor-move"
                          >
                            <img
                              src={meal.strMealThumb}
                              alt={meal.strMeal}
                              className="w-8 h-8 rounded-lg object-cover flex-shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-neutral-800 dark:text-neutral-200 truncate">{meal.strMeal}</p>
                              <p className="text-[10px] text-neutral-400 dark:text-neutral-500">{type}</p>
                            </div>
                            <button
                              onClick={() => onRemove(day, type)}
                              className="text-neutral-300 dark:text-neutral-600 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors text-xs"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-dashed border-neutral-200 dark:border-neutral-700" />
                            <p className="text-[10px] text-neutral-300 dark:text-neutral-600">{type}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default MealPlan;