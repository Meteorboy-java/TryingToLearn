import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { convertFileSrc } from "@tauri-apps/api/core";

// DOM Elements
const audioEl = document.getElementById('audio-player') as HTMLAudioElement;
const playPauseBtn = document.getElementById('play-pause-btn')!;
const addFolderBtn = document.getElementById('add-folder-btn')!;
const trackTitle = document.getElementById('track-title')!;
const trackArtist = document.getElementById('track-artist')!;
const albumArt = document.getElementById('album-art') as HTMLImageElement;
const placeholderArt = document.getElementById('placeholder-art')!;
const lyricsContainer = document.getElementById('lyrics-container')!;

let currentLyrics: { time: number; text: string }[] = [];
let currentActiveIndex = -1;

// --- 1. Audio Controls ---
playPauseBtn.addEventListener('click', () => {
    if (audioEl.paused) {
        audioEl.play();
        playPauseBtn.innerText = '⏸';
    } else {
        audioEl.pause();
        playPauseBtn.innerText = '▶';
    }
});

// --- 2. Folder Selection & Playback ---
addFolderBtn.addEventListener('click', async () => {
    const selectedPath = await open({
        multiple: false,
        directory: false, // For this test, select an actual .mp3 or .flac file directly
        filters: [{ name: 'Audio', extensions: ['mp3', 'flac'] }]
    });

    if (selectedPath && typeof selectedPath === 'string') {
        playTrack(selectedPath);
    }
});

async function playTrack(filePath: string) {
    // Stream audio natively through Tauri
    const assetUrl = convertFileSrc(filePath);
    audioEl.src = assetUrl;
    audioEl.play();
    playPauseBtn.innerText = '⏸';

    // Get Metadata via Rust
    try {
        const metadata: any = await invoke('get_track_info', { path: filePath });
        trackTitle.innerText = metadata.title;
        trackArtist.innerText = metadata.artist;

        if (metadata.coverArt) {
            albumArt.src = metadata.coverArt;
            albumArt.style.display = 'block';
            placeholderArt.style.display = 'none';
        }
    } catch (e) {
        console.error("Failed to read metadata", e);
    }

    // Try to load .lrc file (assumes it has the exact same name as the audio file)
    const lrcPath = filePath.replace(/\.[^/.]+$/, "") + ".lrc";
    try {
        const lrcText = await readTextFile(lrcPath);
        currentLyrics = parseLRC(lrcText);
        renderLyrics();
    } catch (e) {
        lyricsContainer.innerHTML = '<div class="lyric-line">No lyrics found</div>';
        currentLyrics = [];
    }
}

// --- 3. LRC Parsing & Syncing ---
function parseLRC(lrcText: string) {
    const lines = lrcText.split('\n');
    const lyrics = [];
    const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/;

    for (const line of lines) {
        const match = timeRegex.exec(line);
        if (match) {
            const minutes = parseInt(match[1], 10);
            const seconds = parseInt(match[2], 10);
            const milliseconds = match[3].length === 2 ? parseInt(match[3], 10) * 10 : parseInt(match[3], 10);
            const timeInSeconds = (minutes * 60) + seconds + (milliseconds / 1000);
            const text = line.replace(timeRegex, '').trim();
            if (text) lyrics.push({ time: timeInSeconds, text });
        }
    }
    return lyrics;
}

function renderLyrics() {
    lyricsContainer.innerHTML = '';
    currentLyrics.forEach((lyric, idx) => {
        const div = document.createElement('div');
        div.className = 'lyric-line';
        div.innerText = lyric.text;
        div.id = `lyric-${idx}`;
        div.addEventListener('click', () => {
            audioEl.currentTime = lyric.time;
            audioEl.play();
        });
        lyricsContainer.appendChild(div);
    });
}

audioEl.addEventListener('timeupdate', () => {
    const currentTime = audioEl.currentTime;
    let newIndex = currentLyrics.findIndex((lyric, index) => {
        const nextLyricTime = currentLyrics[index + 1] ? currentLyrics[index + 1].time : Infinity;
        return currentTime >= lyric.time && currentTime < nextLyricTime;
    });

    if (newIndex !== -1 && newIndex !== currentActiveIndex) {
        currentActiveIndex = newIndex;
        document.querySelectorAll('.lyric-line').forEach(el => el.classList.remove('active'));
        const activeEl = document.getElementById(`lyric-${currentActiveIndex}`);
        if (activeEl) {
            activeEl.classList.add('active');
            activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
});

// --- 4. Custom Gradient Logic ---
const color1 = document.getElementById('color1') as HTMLInputElement;
const color2 = document.getElementById('color2') as HTMLInputElement;
const updateGradient = () => {
    document.documentElement.style.setProperty('--bg-color-1', color1.value);
    document.documentElement.style.setProperty('--bg-color-2', color2.value);
};
color1.addEventListener('input', updateGradient);
color2.addEventListener('input', updateGradient);

const opacitySlider = document.getElementById('opacity-slider') as HTMLInputElement;

opacitySlider.addEventListener('input', () => {
    document.documentElement.style.setProperty('--glass-opacity', opacitySlider.value);
});