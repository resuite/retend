//! Non-visual audio playback. Device and decoder work stay off GPUI's UI thread.
use std::{
    collections::HashMap,
    fs::File,
    path::PathBuf,
    sync::{mpsc, Mutex, OnceLock},
    thread,
};

use rodio::{source::EmptyCallback, Decoder, OutputStream, OutputStreamBuilder, Sink};

use crate::{
    events::{self, NativeEventPayload},
    protocol_generated::NativeEventId,
    tree::{AudioConfig, NodeId, WindowId},
};

type AudioKey = (WindowId, NodeId);
type AudioChanges = HashMap<AudioKey, Option<AudioConfig>>;

enum Command {
    Sync,
    Play(AudioKey),
    Pause(AudioKey),
    Ended(AudioKey, u64),
    Close(WindowId),
}

struct AudioWorker {
    tx: mpsc::Sender<Command>,
    pending: Mutex<AudioChanges>,
}

impl AudioWorker {
    fn enqueue(&self, window: WindowId, changes: Vec<(NodeId, Option<AudioConfig>)>) {
        let mut pending = self.pending.lock().expect("audio pending lock poisoned");
        let notify = pending.is_empty();
        for (id, config) in changes {
            pending.insert((window, id), config);
        }
        if notify {
            let _ = self.tx.send(Command::Sync);
        }
    }

    fn take_pending(&self) -> AudioChanges {
        std::mem::take(&mut *self.pending.lock().expect("audio pending lock poisoned"))
    }

    fn close(&self, window: WindowId) {
        let mut pending = self.pending.lock().expect("audio pending lock poisoned");
        pending.retain(|key, _| key.0 != window);
        let _ = self.tx.send(Command::Close(window));
    }
}

static WORKER: OnceLock<AudioWorker> = OnceLock::new();

fn worker() -> &'static AudioWorker {
    WORKER.get_or_init(|| {
        let (tx, rx) = mpsc::channel();
        let thread_tx = tx.clone();
        thread::Builder::new()
            .name("retend-audio".to_owned())
            .spawn(move || run(rx, thread_tx))
            .expect("failed to start Retend audio worker");
        AudioWorker {
            tx,
            pending: Mutex::new(HashMap::new()),
        }
    })
}

pub fn sync(window: WindowId, changes: Vec<(NodeId, Option<AudioConfig>)>) {
    if changes.is_empty() {
        return;
    }
    // Creating a detached audio node does not create a playback worker.
    let w = if changes.iter().any(|(_, config)| config.is_some()) {
        worker()
    } else if let Some(w) = WORKER.get() {
        w
    } else {
        return;
    };
    w.enqueue(window, changes);
}

pub fn play(window: WindowId, id: NodeId) {
    let _ = worker().tx.send(Command::Play((window, id)));
}

pub fn pause(window: WindowId, id: NodeId) {
    if let Some(w) = WORKER.get() {
        let _ = w.tx.send(Command::Pause((window, id)));
    }
}

pub fn close(window: WindowId) {
    if let Some(w) = WORKER.get() {
        w.close(window);
    }
}

fn report((window, id): AudioKey, event: NativeEventId) {
    events::emit(window, NativeEventPayload::new(event, id));
}

fn audio_path(src: &str) -> Result<PathBuf, String> {
    if src.starts_with("file:") {
        let url = url::Url::parse(src).map_err(|error| error.to_string())?;
        url.to_file_path()
            .map_err(|_| "Invalid file URL for audio source.".to_owned())
    } else if src.contains("://") {
        Err("Native audio currently supports local files and imported assets only.".to_owned())
    } else {
        Ok(PathBuf::from(src))
    }
}

struct Playback {
    config: AudioConfig,
    sink: Option<Sink>,
    generation: u64,
}

impl Playback {
    fn new(config: AudioConfig) -> Self {
        Self {
            config,
            sink: None,
            generation: 0,
        }
    }

    fn stop(&mut self) {
        self.generation = self.generation.wrapping_add(1);
        if let Some(sink) = self.sink.take() {
            sink.stop();
        }
    }

    fn set_volume(&self) {
        if let Some(sink) = &self.sink {
            sink.set_volume(if self.config.muted {
                0.0
            } else {
                self.config.volume
            });
        }
    }
}

#[derive(Default)]
struct AudioState {
    playback: HashMap<AudioKey, Playback>,
}

impl AudioState {
    fn reconcile(
        &mut self,
        changes: AudioChanges,
        start: &mut impl FnMut(AudioKey, &mut Playback),
    ) {
        for (key, update) in changes {
            let Some(config) = update else {
                if let Some(mut clip) = self.playback.remove(&key) {
                    clip.stop();
                }
                continue;
            };
            if let Some(clip) = self.playback.get_mut(&key) {
                if clip.config == config {
                    continue;
                }
                let source_changed = clip.config.src != config.src;
                let autoplay_enabled = !clip.config.autoplay && config.autoplay;
                let was_playing = clip.sink.as_ref().is_some_and(|sink| !sink.is_paused());
                if source_changed {
                    clip.stop();
                }
                clip.config = config;
                if clip.config.src.is_some()
                    && ((source_changed && (was_playing || clip.config.autoplay))
                        || (autoplay_enabled && clip.sink.is_none()))
                {
                    start(key, clip);
                } else {
                    clip.set_volume();
                }
            } else {
                let mut clip = Playback::new(config);
                if clip.config.autoplay && clip.config.src.is_some() {
                    start(key, &mut clip);
                }
                self.playback.insert(key, clip);
            }
        }
    }

    fn play(&mut self, key: AudioKey, start: &mut impl FnMut(AudioKey, &mut Playback)) {
        if let Some(clip) = self.playback.get_mut(&key) {
            if clip.sink.as_ref().is_some_and(|sink| !sink.empty()) {
                clip.sink.as_ref().unwrap().play();
            } else {
                clip.stop();
                start(key, clip);
            }
        }
    }

    fn pause(&mut self, key: AudioKey) {
        if let Some(sink) = self.playback.get(&key).and_then(|clip| clip.sink.as_ref()) {
            sink.pause();
        }
    }

    fn ended(
        &mut self,
        key: AudioKey,
        generation: u64,
        start: &mut impl FnMut(AudioKey, &mut Playback),
    ) -> bool {
        let Some(clip) = self.playback.get_mut(&key) else {
            return false;
        };
        if clip.generation != generation {
            return false;
        }
        clip.stop();
        if clip.config.looping {
            start(key, clip);
            false
        } else {
            true
        }
    }

    fn close(&mut self, window: WindowId) {
        self.playback.retain(|key, clip| {
            if key.0 == window {
                clip.stop();
                false
            } else {
                true
            }
        });
    }

    fn is_idle(&self) -> bool {
        self.playback.values().all(|clip| clip.sink.is_none())
    }
}

fn start_clip(
    key: AudioKey,
    clip: &mut Playback,
    stream: &mut Option<OutputStream>,
    tx: &mpsc::Sender<Command>,
) {
    let result = (|| {
        let src = clip.config.src.as_deref().ok_or("Audio src is missing.")?;
        let file = File::open(audio_path(src)?).map_err(|error| error.to_string())?;
        let decoder = Decoder::try_from(file).map_err(|error| error.to_string())?;
        if stream.is_none() {
            *stream = Some(
                OutputStreamBuilder::open_default_stream().map_err(|error| error.to_string())?,
            );
        }
        let sink = Sink::connect_new(stream.as_ref().expect("audio stream initialized").mixer());
        sink.append(decoder);
        let generation = clip.generation.wrapping_add(1);
        let tx = tx.clone();
        sink.append(EmptyCallback::new(Box::new(move || {
            let _ = tx.send(Command::Ended(key, generation));
        })));
        sink.set_volume(if clip.config.muted {
            0.0
        } else {
            clip.config.volume
        });
        Ok::<_, String>((sink, generation))
    })();

    match result {
        Ok((sink, generation)) => {
            clip.generation = generation;
            clip.sink = Some(sink);
        }
        Err(error) => {
            eprintln!("Retend audio: {error}");
            report(key, NativeEventId::Error);
        }
    }
}

fn run(receiver: mpsc::Receiver<Command>, tx: mpsc::Sender<Command>) {
    let mut stream = None;
    let mut state = AudioState::default();
    while let Ok(command) = receiver.recv() {
        let mut start = |key, clip: &mut Playback| start_clip(key, clip, &mut stream, &tx);
        match command {
            Command::Sync => {
                let changes = worker().take_pending();
                state.reconcile(changes, &mut start);
            }
            Command::Play(key) => state.play(key, &mut start),
            Command::Pause(key) => state.pause(key),
            Command::Ended(key, generation) => {
                if state.ended(key, generation, &mut start) {
                    report(key, NativeEventId::Ended);
                }
            }
            Command::Close(window) => state.close(window),
        }
        if state.is_idle() {
            stream = None;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::Cell;

    fn config(id: NodeId) -> AudioConfig {
        AudioConfig {
            id,
            src: Some("test.wav".to_owned()),
            autoplay: false,
            looping: false,
            muted: false,
            volume: 1.0,
        }
    }

    fn updates(window: WindowId, config: Option<AudioConfig>) -> AudioChanges {
        let id = config.as_ref().map_or(5, |clip| clip.id);
        HashMap::from([((window, id), config)])
    }

    #[test]
    fn lifecycle_reconciles_pause_resume_loop_source_and_window_close_without_an_audio_device() {
        let mixer = rodio::mixer::mixer(2, 44_100);
        let starts = Cell::new(0);
        let mut start = |_: AudioKey, clip: &mut Playback| {
            starts.set(starts.get() + 1);
            let sink = Sink::connect_new(&mixer.0);
            // Keep a source in the queue so pause/resume operates on an active sink.
            sink.append(rodio::source::SineWave::new(440.0));
            clip.generation = clip.generation.wrapping_add(1);
            clip.sink = Some(sink);
        };
        let key = (1, 5);
        let mut state = AudioState::default();

        state.reconcile(updates(1, Some(config(5))), &mut start);
        assert_eq!(starts.get(), 0);
        state.play(key, &mut start);
        assert_eq!(starts.get(), 1);
        let initial_generation = state.playback[&key].generation;
        state.pause(key);
        assert!(state.playback[&key].sink.as_ref().unwrap().is_paused());
        state.play(key, &mut start);
        assert_eq!(starts.get(), 1, "resume must not decode again");
        assert!(!state.playback[&key].sink.as_ref().unwrap().is_paused());

        let mut looping = config(5);
        looping.looping = true;
        state.reconcile(updates(1, Some(looping.clone())), &mut start);
        assert_eq!(starts.get(), 1, "changing loop must not restart audio");
        assert!(!state.ended(key, initial_generation, &mut start));
        assert_eq!(starts.get(), 2, "completion must restart a looping track");
        assert!(
            !state.ended(key, initial_generation, &mut start),
            "stale completion must be ignored"
        );
        assert_eq!(starts.get(), 2);
        looping.looping = false;
        state.reconcile(updates(1, Some(looping.clone())), &mut start);
        let last = state.playback[&key].generation;
        assert!(state.ended(key, last, &mut start));
        assert_eq!(starts.get(), 2);

        looping.src = Some("replacement.wav".to_owned());
        looping.autoplay = true;
        state.reconcile(updates(1, Some(looping)), &mut start);
        assert_eq!(starts.get(), 3);
        state.close(1);
        assert!(state.playback.is_empty());
        assert!(!state.ended(key, last, &mut start));
        assert_eq!(starts.get(), 3);
    }

    #[test]
    fn failed_start_can_retry_and_enabling_autoplay_starts_idle_clip() {
        let mixer = rodio::mixer::mixer(2, 44_100);
        let attempts = Cell::new(0);
        let mut start = |_: AudioKey, clip: &mut Playback| {
            attempts.set(attempts.get() + 1);
            if attempts.get() > 1 {
                clip.generation = clip.generation.wrapping_add(1);
                clip.sink = Some(Sink::connect_new(&mixer.0));
            }
        };
        let key = (1, 5);
        let mut state = AudioState::default();
        state.reconcile(updates(1, Some(config(5))), &mut start);
        state.play(key, &mut start);
        assert_eq!(attempts.get(), 1);
        assert!(state.playback[&key].sink.is_none());
        state.play(key, &mut start);
        assert_eq!(attempts.get(), 2);
        state.pause(key);
        let mut clip = config(5);
        clip.autoplay = true;
        state.reconcile(updates(1, Some(clip)), &mut start);
        assert_eq!(
            attempts.get(),
            2,
            "autoplay must not override a paused track"
        );

        state.reconcile(updates(1, None), &mut start);
        assert!(!state.playback.contains_key(&key));
        state.reconcile(updates(1, Some(config(5))), &mut start);
        let mut clip = config(5);
        clip.autoplay = true;
        state.reconcile(updates(1, Some(clip)), &mut start);
        assert_eq!(attempts.get(), 3, "enabling autoplay starts an idle clip");
    }

    #[test]
    fn repeated_updates_coalesce_without_growing_the_worker_queue() {
        let (tx, rx) = mpsc::channel();
        let w = AudioWorker {
            tx,
            pending: Mutex::new(HashMap::new()),
        };
        for i in 0..10_000 {
            let mut clip = config(5);
            clip.volume = i as f32 / 10_000.0;
            w.enqueue(1, vec![(5, Some(clip))]);
        }
        assert!(matches!(rx.try_recv(), Ok(Command::Sync)));
        assert!(rx.try_recv().is_err(), "one notification per pending batch");
        let batch = w.take_pending();
        assert_eq!(batch.len(), 1);
        assert_eq!(batch[&(1, 5)].as_ref().unwrap().volume, 0.9999);

        w.enqueue(1, vec![(5, Some(config(5)))]);
        w.enqueue(2, vec![(6, Some(config(6)))]);
        w.close(1);
        let batch = w.take_pending();
        assert_eq!(batch.len(), 1);
        assert!(batch.contains_key(&(2, 6)));
        assert!(matches!(rx.try_recv(), Ok(Command::Sync)));
        assert!(matches!(rx.try_recv(), Ok(Command::Close(1))));
        assert!(rx.try_recv().is_err());
    }

    #[test]
    fn audio_sources_are_files_only() {
        assert_eq!(
            audio_path("/tmp/sample.wav").unwrap(),
            PathBuf::from("/tmp/sample.wav")
        );
        assert_eq!(
            audio_path("file:///tmp/sample.wav").unwrap(),
            PathBuf::from("/tmp/sample.wav")
        );
        assert!(audio_path("https://example.test/sample.wav").is_err());
    }
}
