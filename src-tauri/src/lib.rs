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
        // Filter by area client-side if needed, or by name
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

    // Default: search by name
    let search_term = if query.is_empty() { "a".to_string() } else { query };
    let url = format!("{}/search.php?s={}", BASE_URL, search_term);
    let body: Value = reqwest::get(&url)
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    let meals = body["meals"].as_array().cloned().unwrap_or_default();
    Ok(serde_json::to_string(&meals).map_err(|e| e.to_string())?)
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
