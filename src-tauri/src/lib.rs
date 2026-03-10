use std::collections::HashSet;
use std::fs;
use std::path::PathBuf;

use reqwest;
use serde_json::Value;

const BASE_URL: &str = "https://www.themealdb.com/api/json/v1/1";

fn data_dir() -> PathBuf {
    let dir = dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("smartmeal");
    fs::create_dir_all(&dir).ok();
    dir
}

#[tauri::command]
async fn search_recipes(query: String, category: String, area: String) -> Result<String, String> {
    // If category or area filter is set, use filter endpoint then fetch details
    if !category.is_empty() {
        let url = format!("{}/filter.php?c={}", BASE_URL, category);
        let body: Value = reqwest::get(&url)
            .await
            .map_err(|e| e.to_string())?
            .json()
            .await
            .map_err(|e| e.to_string())?;

        let meals = body["meals"].as_array().cloned().unwrap_or_default();
        let filtered = filter_meals(meals, &query, &area).await;
        return Ok(serde_json::to_string(&filtered).map_err(|e| e.to_string())?);
    }

    if !area.is_empty() {
        let url = format!("{}/filter.php?a={}", BASE_URL, area);
        let body: Value = reqwest::get(&url)
            .await
            .map_err(|e| e.to_string())?
            .json()
            .await
            .map_err(|e| e.to_string())?;

        let meals = body["meals"].as_array().cloned().unwrap_or_default();
        let filtered = filter_meals(meals, &query, "").await;
        return Ok(serde_json::to_string(&filtered).map_err(|e| e.to_string())?);
    }

    // No filters — search by name, and also try matching categories/areas
    let search_term = if query.is_empty() { "a".to_string() } else { query.clone() };

    // 1) Name search
    let url = format!("{}/search.php?s={}", BASE_URL, search_term);
    let body: Value = reqwest::get(&url)
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;
    let mut all_meals = body["meals"].as_array().cloned().unwrap_or_default();

    if !query.is_empty() {
        let q_lower = query.to_lowercase();

        // 2) Check if query matches a category name — fetch all recipes in that category
        if let Ok(cats_json) = fetch_categories().await {
            if let Ok(cats) = serde_json::from_str::<Vec<String>>(&cats_json) {
                for cat in &cats {
                    if cat.to_lowercase().contains(&q_lower) || q_lower.contains(&cat.to_lowercase()) {
                        let cat_url = format!("{}/filter.php?c={}", BASE_URL, cat);
                        if let Ok(resp) = reqwest::get(&cat_url).await {
                            if let Ok(cat_body) = resp.json::<Value>().await {
                                if let Some(cat_meals) = cat_body["meals"].as_array() {
                                    for m in cat_meals {
                                        all_meals.push(m.clone());
                                    }
                                }
                            }
                        }
                        break; // Only match the first category
                    }
                }
            }
        }

        // 3) Check if query matches an area/cuisine name — fetch all recipes for that area
        if let Ok(areas_json) = fetch_areas().await {
            if let Ok(areas) = serde_json::from_str::<Vec<String>>(&areas_json) {
                for ar in &areas {
                    if ar.to_lowercase().contains(&q_lower) || q_lower.contains(&ar.to_lowercase()) {
                        let area_url = format!("{}/filter.php?a={}", BASE_URL, ar);
                        if let Ok(resp) = reqwest::get(&area_url).await {
                            if let Ok(area_body) = resp.json::<Value>().await {
                                if let Some(area_meals) = area_body["meals"].as_array() {
                                    for m in area_meals {
                                        all_meals.push(m.clone());
                                    }
                                }
                            }
                        }
                        break; // Only match the first area
                    }
                }
            }
        }
    }

    // Deduplicate by idMeal
    let mut seen = std::collections::HashSet::new();
    let unique: Vec<Value> = all_meals
        .into_iter()
        .filter(|m| {
            let id = m["idMeal"].as_str().unwrap_or("").to_string();
            seen.insert(id)
        })
        .collect();

    Ok(serde_json::to_string(&unique).map_err(|e| e.to_string())?)
}

async fn filter_meals(meals: Vec<Value>, query: &str, area: &str) -> Vec<Value> {
    let query_lower = query.to_lowercase();
    let mut result = Vec::new();

    for meal in meals {
        let name = meal["strMeal"]
            .as_str()
            .unwrap_or("")
            .to_lowercase();
        if !query.is_empty() && !name.contains(&query_lower) {
            continue;
        }
        // If we need area filtering on filter results, fetch detail
        if !area.is_empty() {
            if let Some(id) = meal["idMeal"].as_str() {
                if let Ok(detail) = fetch_detail(id).await {
                    let meal_area = detail["strArea"].as_str().unwrap_or("");
                    if meal_area.eq_ignore_ascii_case(area) {
                        result.push(detail);
                    }
                }
            }
            continue;
        }
        result.push(meal);
    }
    result
}

async fn fetch_detail(id: &str) -> Result<Value, String> {
    let url = format!("{}/lookup.php?i={}", BASE_URL, id);
    let body: Value = reqwest::get(&url)
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    body["meals"]
        .as_array()
        .and_then(|m| m.first().cloned())
        .ok_or_else(|| "Recipe not found".to_string())
}

#[tauri::command]
async fn search_by_ingredient(ingredient: String) -> Result<String, String> {
    let url = format!("{}/filter.php?i={}", BASE_URL, ingredient);
    let body: Value = reqwest::get(&url)
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    let meals = body["meals"].as_array().cloned().unwrap_or_default();
    Ok(serde_json::to_string(&meals).map_err(|e| e.to_string())?)
}

#[tauri::command]
async fn get_recipe_detail(id: String) -> Result<String, String> {
    let detail = fetch_detail(&id).await?;
    serde_json::to_string(&detail).map_err(|e| e.to_string())
}

#[tauri::command]
async fn random_recipe() -> Result<String, String> {
    let url = format!("{}/random.php", BASE_URL);
    let body: Value = reqwest::get(&url)
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    let meal = body["meals"]
        .as_array()
        .and_then(|m| m.first().cloned())
        .ok_or_else(|| "No random recipe found".to_string())?;

    serde_json::to_string(&meal).map_err(|e| e.to_string())
}

#[tauri::command]
async fn fetch_categories() -> Result<String, String> {
    let url = format!("{}/list.php?c=list", BASE_URL);
    let body: Value = reqwest::get(&url)
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    let cats: Vec<String> = body["meals"]
        .as_array()
        .unwrap_or(&vec![])
        .iter()
        .filter_map(|m| m["strCategory"].as_str().map(String::from))
        .collect();

    serde_json::to_string(&cats).map_err(|e| e.to_string())
}

#[tauri::command]
async fn fetch_areas() -> Result<String, String> {
    let url = format!("{}/list.php?a=list", BASE_URL);
    let body: Value = reqwest::get(&url)
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    let areas: Vec<String> = body["meals"]
        .as_array()
        .unwrap_or(&vec![])
        .iter()
        .filter_map(|m| m["strArea"].as_str().map(String::from))
        .collect();

    serde_json::to_string(&areas).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_favorites(data: String) -> Result<(), String> {
    let path = data_dir().join("favorites.json");
    fs::write(&path, &data).map_err(|e| e.to_string())
}

#[tauri::command]
fn load_favorites() -> Result<String, String> {
    let path = data_dir().join("favorites.json");
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_meal_plan(data: String) -> Result<(), String> {
    let path = data_dir().join("meal_plan.json");
    fs::write(&path, &data).map_err(|e| e.to_string())
}

#[tauri::command]
fn load_meal_plan() -> Result<String, String> {
    let path = data_dir().join("meal_plan.json");
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_templates(data: String) -> Result<(), String> {
    let path = data_dir().join("templates.json");
    fs::write(&path, &data).map_err(|e| e.to_string())
}

#[tauri::command]
fn load_templates() -> Result<String, String> {
    let path = data_dir().join("templates.json");
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
async fn fetch_nutrition(ingredients: Vec<String>) -> Result<String, String> {
    // Estimate nutrition from ingredient strings using a simple lookup approach
    // We'll calculate rough estimates based on common ingredient data
    let mut total_cal: f64 = 0.0;
    let mut total_protein: f64 = 0.0;
    let mut total_carbs: f64 = 0.0;
    let mut total_fat: f64 = 0.0;

    for ingredient in &ingredients {
        let lower = ingredient.to_lowercase();
        // Rough per-serving estimates for common ingredient categories
        let (cal, protein, carbs, fat) = estimate_macros(&lower);
        total_cal += cal;
        total_protein += protein;
        total_carbs += carbs;
        total_fat += fat;
    }

    let nutrition = serde_json::json!({
        "calories": (total_cal as i64),
        "protein": format!("{:.0}g", total_protein),
        "carbs": format!("{:.0}g", total_carbs),
        "fat": format!("{:.0}g", total_fat),
        "servings": 4,
        "perServing": (total_cal as i64) / 4
    });

    serde_json::to_string(&nutrition).map_err(|e| e.to_string())
}

fn estimate_macros(ingredient: &str) -> (f64, f64, f64, f64) {
    // Returns (calories, protein_g, carbs_g, fat_g) estimates per typical recipe portion
    if ingredient.contains("chicken") || ingredient.contains("turkey") {
        (250.0, 30.0, 0.0, 14.0)
    } else if ingredient.contains("beef") || ingredient.contains("steak") || ingredient.contains("mince") {
        (300.0, 26.0, 0.0, 22.0)
    } else if ingredient.contains("pork") || ingredient.contains("bacon") || ingredient.contains("sausage") {
        (280.0, 20.0, 1.0, 22.0)
    } else if ingredient.contains("salmon") || ingredient.contains("tuna") || ingredient.contains("fish") || ingredient.contains("cod") || ingredient.contains("prawn") || ingredient.contains("shrimp") {
        (200.0, 25.0, 0.0, 10.0)
    } else if ingredient.contains("egg") {
        (140.0, 12.0, 1.0, 10.0)
    } else if ingredient.contains("rice") {
        (200.0, 4.0, 45.0, 0.5)
    } else if ingredient.contains("pasta") || ingredient.contains("noodle") || ingredient.contains("spaghetti") || ingredient.contains("penne") || ingredient.contains("macaroni") {
        (220.0, 8.0, 43.0, 1.5)
    } else if ingredient.contains("bread") || ingredient.contains("flour") || ingredient.contains("tortilla") {
        (180.0, 6.0, 34.0, 2.0)
    } else if ingredient.contains("potato") {
        (160.0, 4.0, 37.0, 0.2)
    } else if ingredient.contains("cheese") || ingredient.contains("parmesan") || ingredient.contains("cheddar") || ingredient.contains("mozzarella") {
        (110.0, 7.0, 1.0, 9.0)
    } else if ingredient.contains("milk") || ingredient.contains("cream") || ingredient.contains("yoghurt") || ingredient.contains("yogurt") {
        (80.0, 4.0, 6.0, 4.0)
    } else if ingredient.contains("butter") {
        (100.0, 0.1, 0.0, 11.5)
    } else if ingredient.contains("oil") || ingredient.contains("olive") {
        (120.0, 0.0, 0.0, 14.0)
    } else if ingredient.contains("sugar") || ingredient.contains("honey") || ingredient.contains("syrup") {
        (60.0, 0.0, 16.0, 0.0)
    } else if ingredient.contains("onion") || ingredient.contains("garlic") || ingredient.contains("celery") || ingredient.contains("leek") {
        (25.0, 1.0, 6.0, 0.1)
    } else if ingredient.contains("tomato") || ingredient.contains("pepper") || ingredient.contains("carrot") || ingredient.contains("mushroom") || ingredient.contains("spinach") || ingredient.contains("broccoli") || ingredient.contains("peas") || ingredient.contains("bean") || ingredient.contains("courgette") || ingredient.contains("zucchini") || ingredient.contains("aubergine") || ingredient.contains("eggplant") || ingredient.contains("corn") || ingredient.contains("cabbage") || ingredient.contains("lettuce") {
        (35.0, 2.0, 7.0, 0.3)
    } else if ingredient.contains("lentil") || ingredient.contains("chickpea") {
        (170.0, 12.0, 30.0, 2.0)
    } else if ingredient.contains("coconut milk") || ingredient.contains("coconut cream") {
        (140.0, 1.5, 3.0, 14.0)
    } else if ingredient.contains("stock") || ingredient.contains("broth") || ingredient.contains("water") {
        (10.0, 1.0, 1.0, 0.0)
    } else if ingredient.contains("salt") || ingredient.contains("pepper") || ingredient.contains("spice") || ingredient.contains("cumin") || ingredient.contains("paprika") || ingredient.contains("cinnamon") || ingredient.contains("oregano") || ingredient.contains("basil") || ingredient.contains("thyme") || ingredient.contains("parsley") || ingredient.contains("chili") || ingredient.contains("ginger") || ingredient.contains("turmeric") || ingredient.contains("coriander") || ingredient.contains("mint") {
        (5.0, 0.2, 1.0, 0.1)
    } else if ingredient.contains("nut") || ingredient.contains("almond") || ingredient.contains("walnut") || ingredient.contains("peanut") || ingredient.contains("cashew") {
        (170.0, 6.0, 6.0, 15.0)
    } else if ingredient.contains("chocolate") || ingredient.contains("cocoa") {
        (100.0, 2.0, 12.0, 6.0)
    } else if ingredient.contains("sauce") || ingredient.contains("soy") || ingredient.contains("vinegar") || ingredient.contains("worcestershire") || ingredient.contains("ketchup") || ingredient.contains("mustard") {
        (20.0, 1.0, 4.0, 0.2)
    } else if ingredient.contains("lemon") || ingredient.contains("lime") || ingredient.contains("orange") || ingredient.contains("apple") || ingredient.contains("banana") {
        (40.0, 0.5, 10.0, 0.2)
    } else {
        (30.0, 1.0, 5.0, 1.0)
    }
}

fn estimate_ingredient_cost(ingredient: &str, measure: &str) -> f64 {
    let lower_ing = ingredient.to_lowercase();
    let lower_meas = measure.to_lowercase();

    // Parse quantity multiplier from measure (e.g. "2 cups", "500g", "1/2 tsp")
    let qty = parse_quantity(&lower_meas);
    // Determine portion scale: small amounts (tsp, pinch, dash) cost less
    let scale = measure_scale(&lower_meas);

    let base_cost = if lower_ing.contains("chicken") || lower_ing.contains("turkey") {
        3.50
    } else if lower_ing.contains("beef") || lower_ing.contains("steak") || lower_ing.contains("mince") {
        5.00
    } else if lower_ing.contains("pork") || lower_ing.contains("bacon") || lower_ing.contains("sausage") {
        4.00
    } else if lower_ing.contains("salmon") || lower_ing.contains("tuna") || lower_ing.contains("fish") || lower_ing.contains("cod") || lower_ing.contains("prawn") || lower_ing.contains("shrimp") || lower_ing.contains("crab") || lower_ing.contains("lobster") {
        5.00
    } else if lower_ing.contains("lamb") {
        6.00
    } else if lower_ing.contains("egg") {
        0.30
    } else if lower_ing.contains("rice") {
        0.60
    } else if lower_ing.contains("pasta") || lower_ing.contains("noodle") || lower_ing.contains("spaghetti") || lower_ing.contains("penne") || lower_ing.contains("macaroni") {
        0.80
    } else if lower_ing.contains("bread") || lower_ing.contains("flour") || lower_ing.contains("tortilla") {
        0.80
    } else if lower_ing.contains("potato") {
        0.50
    } else if lower_ing.contains("cheese") || lower_ing.contains("parmesan") || lower_ing.contains("cheddar") || lower_ing.contains("mozzarella") {
        1.50
    } else if lower_ing.contains("milk") || lower_ing.contains("cream") || lower_ing.contains("yoghurt") || lower_ing.contains("yogurt") {
        1.00
    } else if lower_ing.contains("butter") {
        0.60
    } else if lower_ing.contains("oil") || lower_ing.contains("olive") {
        0.40
    } else if lower_ing.contains("sugar") || lower_ing.contains("honey") || lower_ing.contains("syrup") {
        0.30
    } else if lower_ing.contains("onion") || lower_ing.contains("garlic") || lower_ing.contains("celery") || lower_ing.contains("leek") {
        0.30
    } else if lower_ing.contains("tomato") || lower_ing.contains("pepper") || lower_ing.contains("carrot") || lower_ing.contains("mushroom") || lower_ing.contains("spinach") || lower_ing.contains("broccoli") || lower_ing.contains("peas") || lower_ing.contains("bean") || lower_ing.contains("courgette") || lower_ing.contains("zucchini") || lower_ing.contains("aubergine") || lower_ing.contains("eggplant") || lower_ing.contains("corn") || lower_ing.contains("cabbage") || lower_ing.contains("lettuce") {
        0.80
    } else if lower_ing.contains("lentil") || lower_ing.contains("chickpea") {
        0.80
    } else if lower_ing.contains("coconut milk") || lower_ing.contains("coconut cream") {
        1.50
    } else if lower_ing.contains("stock") || lower_ing.contains("broth") {
        0.80
    } else if lower_ing.contains("salt") || lower_ing.contains("pepper") || lower_ing.contains("spice") || lower_ing.contains("cumin") || lower_ing.contains("paprika") || lower_ing.contains("cinnamon") || lower_ing.contains("oregano") || lower_ing.contains("basil") || lower_ing.contains("thyme") || lower_ing.contains("parsley") || lower_ing.contains("chili") || lower_ing.contains("ginger") || lower_ing.contains("turmeric") || lower_ing.contains("coriander") || lower_ing.contains("mint") {
        0.15
    } else if lower_ing.contains("nut") || lower_ing.contains("almond") || lower_ing.contains("walnut") || lower_ing.contains("peanut") || lower_ing.contains("cashew") {
        1.50
    } else if lower_ing.contains("chocolate") || lower_ing.contains("cocoa") {
        1.50
    } else if lower_ing.contains("sauce") || lower_ing.contains("soy") || lower_ing.contains("vinegar") || lower_ing.contains("worcestershire") || lower_ing.contains("ketchup") || lower_ing.contains("mustard") {
        0.50
    } else if lower_ing.contains("lemon") || lower_ing.contains("lime") || lower_ing.contains("orange") || lower_ing.contains("apple") || lower_ing.contains("banana") {
        0.60
    } else if lower_ing.contains("water") {
        0.0
    } else {
        0.40
    };

    base_cost * qty * scale
}

fn parse_quantity(measure: &str) -> f64 {
    let s = measure.trim();
    if s.is_empty() { return 1.0; }

    // Try fraction like "1/2", "1/4"
    if let Some(pos) = s.find('/') {
        let before = &s[..pos];
        let after = &s[pos+1..];
        // Handle "1 1/2" style
        let parts: Vec<&str> = before.split_whitespace().collect();
        if parts.len() == 2 {
            let whole: f64 = parts[0].parse().unwrap_or(0.0);
            let numer: f64 = parts[1].parse().unwrap_or(1.0);
            let denom_str: String = after.chars().take_while(|c| c.is_ascii_digit()).collect();
            let denom: f64 = denom_str.parse().unwrap_or(1.0);
            if denom > 0.0 { return whole + numer / denom; }
        }
        let numer: f64 = before.trim().parse().unwrap_or(1.0);
        let denom_str: String = after.chars().take_while(|c| c.is_ascii_digit()).collect();
        let denom: f64 = denom_str.parse().unwrap_or(1.0);
        if denom > 0.0 { return numer / denom; }
    }

    // Try leading number like "2 cups", "500g", "250ml"
    let num_str: String = s.chars().take_while(|c| c.is_ascii_digit() || *c == '.').collect();
    if !num_str.is_empty() {
        let val: f64 = num_str.parse().unwrap_or(1.0);
        // Normalize gram/ml amounts: 500g → ~1 unit, 100g → ~0.2
        let rest = s[num_str.len()..].trim().to_lowercase();
        if rest.starts_with('g') || rest.starts_with("ml") {
            return (val / 500.0).max(0.1);
        }
        if rest.starts_with("kg") || rest.starts_with("l") {
            return val * 2.0;
        }
        return val.max(0.1);
    }

    1.0
}

fn measure_scale(measure: &str) -> f64 {
    if measure.contains("pinch") || measure.contains("dash") || measure.contains("to taste") || measure.contains("garnish") {
        0.05
    } else if measure.contains("tsp") || measure.contains("teaspoon") {
        0.1
    } else if measure.contains("tbsp") || measure.contains("tablespoon") || measure.contains("tbs") {
        0.2
    } else if measure.contains("cup") {
        1.0
    } else if measure.contains("lb") || measure.contains("pound") {
        1.2
    } else if measure.contains("oz") || measure.contains("ounce") {
        0.4
    } else if measure.contains("bunch") || measure.contains("handful") || measure.contains("sprig") {
        0.3
    } else if measure.contains("can") || measure.contains("tin") {
        1.0
    } else if measure.contains("slice") || measure.contains("clove") || measure.contains("piece") {
        0.2
    } else {
        1.0
    }
}

fn estimate_recipe_cost(meal: &Value) -> f64 {
    let mut total = 0.0;
    for i in 1..=20 {
        let ing_key = format!("strIngredient{}", i);
        let meas_key = format!("strMeasure{}", i);
        let ing = meal[&ing_key].as_str().unwrap_or("").trim();
        let meas = meal[&meas_key].as_str().unwrap_or("").trim();
        if !ing.is_empty() {
            total += estimate_ingredient_cost(ing, meas);
        }
    }
    // Round to 2 decimal places
    (total * 100.0).round() / 100.0
}

#[tauri::command]
async fn suggest_budget_meals(budget: f64) -> Result<String, String> {
    let categories = ["Chicken", "Beef", "Seafood", "Pasta", "Vegetarian", "Pork", "Breakfast", "Lamb"];

    // Phase 1: Fetch category listings in parallel
    let mut cat_handles = Vec::new();
    for cat in &categories {
        let url = format!("{}/filter.php?c={}", BASE_URL, cat);
        cat_handles.push(tokio::spawn(async move {
            let mut ids = Vec::new();
            if let Ok(resp) = reqwest::get(&url).await {
                if let Ok(body) = resp.json::<Value>().await {
                    if let Some(meals) = body["meals"].as_array() {
                        for meal in meals.iter().take(3) {
                            if let Some(id) = meal["idMeal"].as_str() {
                                ids.push(id.to_string());
                            }
                        }
                    }
                }
            }
            ids
        }));
    }

    // Also fetch 4 random recipes in parallel
    let mut rand_handles = Vec::new();
    for _ in 0..4 {
        let url = format!("{}/random.php", BASE_URL);
        rand_handles.push(tokio::spawn(async move {
            if let Ok(resp) = reqwest::get(&url).await {
                if let Ok(body) = resp.json::<Value>().await {
                    if let Some(meals) = body["meals"].as_array() {
                        if let Some(meal) = meals.first() {
                            return meal["idMeal"].as_str().map(String::from);
                        }
                    }
                }
            }
            None
        }));
    }

    // Collect all unique IDs
    let mut seen_ids: HashSet<String> = HashSet::new();
    let mut recipe_ids: Vec<String> = Vec::new();

    for handle in cat_handles {
        if let Ok(ids) = handle.await {
            for id in ids {
                if seen_ids.insert(id.clone()) {
                    recipe_ids.push(id);
                }
            }
        }
    }

    for handle in rand_handles {
        if let Ok(Some(id)) = handle.await {
            if seen_ids.insert(id.clone()) {
                recipe_ids.push(id);
            }
        }
    }

    // Phase 2: Fetch full recipe details in parallel (batches of 10)
    let mut budget_meals: Vec<Value> = Vec::new();

    for chunk in recipe_ids.chunks(10) {
        let mut detail_handles = Vec::new();
        for id in chunk {
            let url = format!("{}/lookup.php?i={}", BASE_URL, id);
            let budget_val = budget;
            detail_handles.push(tokio::spawn(async move {
                if let Ok(resp) = reqwest::get(&url).await {
                    if let Ok(body) = resp.json::<Value>().await {
                        if let Some(meals) = body["meals"].as_array() {
                            if let Some(meal) = meals.first() {
                                let cost = estimate_recipe_cost(meal);
                                if cost <= budget_val {
                                    let mut m = meal.clone();
                                    m["estimatedCost"] = serde_json::json!(format!("{:.2}", cost));
                                    return Some(m);
                                }
                            }
                        }
                    }
                }
                None
            }));
        }

        for handle in detail_handles {
            if let Ok(Some(meal)) = handle.await {
                budget_meals.push(meal);
            }
        }
    }

    // Sort by cost ascending
    budget_meals.sort_by(|a, b| {
        let ca: f64 = a["estimatedCost"].as_str().unwrap_or("0").parse().unwrap_or(0.0);
        let cb: f64 = b["estimatedCost"].as_str().unwrap_or("0").parse().unwrap_or(0.0);
        ca.partial_cmp(&cb).unwrap_or(std::cmp::Ordering::Equal)
    });

    serde_json::to_string(&budget_meals).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            search_recipes,
            search_by_ingredient,
            get_recipe_detail,
            random_recipe,
            fetch_categories,
            fetch_areas,
            save_favorites,
            load_favorites,
            save_meal_plan,
            load_meal_plan,
            save_templates,
            load_templates,
            fetch_nutrition,
            suggest_budget_meals,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
