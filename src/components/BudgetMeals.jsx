import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

const CURRENCIES = [
  { code: "USD", symbol: "$", rate: 1 },
  { code: "EUR", symbol: "€", rate: 0.92 },
  { code: "GBP", symbol: "£", rate: 0.79 },
  { code: "PHP", symbol: "₱", rate: 56.0 },
  { code: "JPY", symbol: "¥", rate: 149.0 },
  { code: "INR", symbol: "₹", rate: 83.0 },
  { code: "AUD", symbol: "A$", rate: 1.53 },
  { code: "CAD", symbol: "C$", rate: 1.36 },
];

export default function BudgetMeals({ onOpen, onAddToPlan, onToggleFav, isFavorite, days, mealTypes }) {
  const [budget, setBudget] = useState("");
  const [currency, setCurrency] = useState(() => localStorage.getItem("budgetCurrency") || "USD");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [planDropdown, setPlanDropdown] = useState(null);

  const curr = CURRENCIES.find((c) => c.code === currency) || CURRENCIES[0];

  function toUsd(amount) {
    return amount / curr.rate;
  }

  function fromUsd(usd) {
    return usd * curr.rate;
  }

  async function findMeals() {
    const amount = parseFloat(budget);
    if (!amount || amount <= 0) return;

    setLoading(true);
    setSearched(true);
    localStorage.setItem("budgetCurrency", currency);

    try {
      const budgetUsd = toUsd(amount);
      const result = await invoke("suggest_budget_meals", { budget: budgetUsd });
      setResults(JSON.parse(result));
    } catch {
      setResults([]);
    }
    setLoading(false);
  }

  function handleKey(e) {
    if (e.key === "Enter") findMeals();
  }

  return (
    <section className="animate-fadeIn">
      <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Budget Meals</h2>

      {/* Budget input row */}
      <div className="space-y-2">
        <label className="block text-[10px] font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">
          Budget per meal
        </label>
        <div className="flex gap-2">
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="px-2 py-2.5 bg-neutral-100 dark:bg-neutral-800 rounded-xl text-xs text-neutral-600 dark:text-neutral-300 outline-none cursor-pointer flex-shrink-0"
          >
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.symbol} {c.code}
              </option>
            ))}
          </select>
          <input
            type="number"
            min="0"
            step="0.01"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            onKeyDown={handleKey}
            placeholder="0.00"
            className="flex-1 min-w-0 px-3 py-2.5 bg-neutral-100 dark:bg-neutral-800 rounded-xl text-sm outline-none placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:bg-white dark:focus:bg-neutral-900 focus:ring-1 focus:ring-neutral-300 dark:focus:ring-neutral-600 transition-all dark:text-neutral-100"
          />
          <button
            onClick={findMeals}
            disabled={loading || !budget}
            className="px-4 py-2.5 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 text-xs font-medium rounded-xl hover:bg-neutral-700 dark:hover:bg-neutral-300 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
          >
            {loading ? "..." : "Find"}
          </button>
        </div>
      </div>

      {/* Info text */}
      <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-2">
        Estimated ingredient costs for ~4 servings. Prices are approximate.
      </p>

      {/* Results */}
      <div className="mt-6">
        {loading ? (
          <div className="text-center text-neutral-400 dark:text-neutral-500 py-16 loading-spinner text-sm">
            Finding affordable meals...
          </div>
        ) : results.length > 0 ? (
          <>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {results.length} meal{results.length !== 1 ? "s" : ""} under {curr.symbol}
                {parseFloat(budget).toFixed(2)}
              </p>
            </div>
            <div className="space-y-2">
              {results.map((r) => {
                const costLocal = fromUsd(parseFloat(r.estimatedCost));
                const fav = isFavorite(r.idMeal);
                return (
                  <div
                    key={r.idMeal}
                    className="flex items-center gap-3 p-2 rounded-xl bg-neutral-50 dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors group"
                  >
                    <img
                      src={r.strMealThumb}
                      alt={r.strMeal}
                      className="w-14 h-14 rounded-lg object-cover flex-shrink-0 cursor-pointer"
                      onClick={() => onOpen(r.idMeal)}
                    />
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onOpen(r.idMeal)}>
                      <p className="text-xs font-medium text-neutral-900 dark:text-neutral-100 truncate">
                        {r.strMeal}
                      </p>
                      <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-0.5">
                        {r.strCategory} · {r.strArea}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                        {curr.symbol}{costLocal.toFixed(2)}
                      </span>
                      <button
                        onClick={() => onToggleFav(r)}
                        className={`w-7 h-7 flex items-center justify-center rounded-full text-xs transition-colors cursor-pointer ${
                          fav
                            ? "bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900"
                            : "bg-neutral-200 dark:bg-neutral-700 text-neutral-400 dark:text-neutral-500"
                        }`}
                      >
                        {fav ? "♥" : "♡"}
                      </button>
                      <div className="relative">
                        <button
                          onClick={() => setPlanDropdown(planDropdown === r.idMeal ? null : r.idMeal)}
                          className="w-7 h-7 flex items-center justify-center rounded-full bg-neutral-200 dark:bg-neutral-700 text-neutral-400 dark:text-neutral-500 text-xs transition-all cursor-pointer hover:bg-neutral-300 dark:hover:bg-neutral-600"
                        >
                          +
                        </button>
                        {planDropdown === r.idMeal && (
                          <div className="absolute right-0 top-full mt-1 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg z-20 w-44 max-h-48 overflow-y-auto animate-scaleIn">
                            {days.map((d) =>
                              mealTypes.map((t) => (
                                <button
                                  key={`${d}-${t}`}
                                  onClick={() => {
                                    onAddToPlan(r, d, t);
                                    setPlanDropdown(null);
                                  }}
                                  className="w-full text-left px-3 py-1.5 text-[10px] text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700 cursor-pointer"
                                >
                                  {d} · {t}
                                </button>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : searched ? (
          <div className="text-center py-16">
            <p className="text-neutral-300 dark:text-neutral-600 text-sm">
              No meals found within this budget
            </p>
            <p className="text-[10px] text-neutral-300 dark:text-neutral-600 mt-1">
              Try increasing your budget
            </p>
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="text-neutral-300 dark:text-neutral-600 text-sm">
              Enter a budget to find affordable meals
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
