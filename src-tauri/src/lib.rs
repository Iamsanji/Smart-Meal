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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
