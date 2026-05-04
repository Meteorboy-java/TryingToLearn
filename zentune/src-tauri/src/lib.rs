use lofty::file::TaggedFileExt;
use lofty::probe::Probe;
use lofty::tag::{Accessor, TagExt};

#[tauri::command]
fn get_track_info(path: &str) -> Result<serde_json::Value, String> {
    let mut title = "Unknown Title".to_string();
    let mut artist = "Unknown Artist".to_string();
    let mut cover_art = String::new();

    // Read the audio file
    if let Ok(tagged_file) = Probe::open(path).and_then(|probe| probe.read()) {
        if let Some(tag) = tagged_file.primary_tag().or_else(|| tagged_file.first_tag()) {
            title = tag.title().as_deref().unwrap_or("Unknown Title").to_string();
            artist = tag.artist().as_deref().unwrap_or("Unknown Artist").to_string();
            
            // Extract the embedded album cover
            if let Some(picture) = tag.pictures().first() {
                let b64 = base64::prelude::BASE64_STANDARD.encode(picture.data());
                let mime_type = picture.mime_type().unwrap_or("image/jpeg");
                cover_art = format!("data:{};base64,{}", mime_type, b64);
            }
        }
    }

    Ok(serde_json::json!({
        "title": title,
        "artist": artist,
        "coverArt": cover_art
    }))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![get_track_info])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}