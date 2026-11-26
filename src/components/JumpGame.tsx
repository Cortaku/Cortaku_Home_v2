'use client';

import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { CalendarDays, Pause, Play, RotateCcw, RotateCw, Share2, Trophy, Volume2, VolumeX, X } from 'lucide-react';
import { Engine, type Phase } from '@/game/engine';
import { GameAudio } from '@/game/audio';
import { VIEW_H, VIEW_W } from '@/game/sim';
import { dailySeed } from '@/game/replay';
import { shareRun } from '@/game/share';
import { SKINS, loadSkinSheet } from '@/game/skins';
import { dailyBestToday, getProfile, recordRun, todayKey, updateProfile, useProfile } from '@/game/profile';
import { requestRun, submitScore, type RunTicket, type SubmitResult } from '@/lib/scores';
import ScoreBoard from './ScoreBoard';
import SkinPicker from './SkinPicker';

type Mode = 'endless' | 'daily';

type Props = {
  onExit: () => void;
  gameTheme: 'day' | 'night';
  /** Scene set the run starts in. */
  backgroundSet?: number;
};

type Result = {
  score: number;
  zone: number;
  isBest: boolean;
  unlocked: string[];
  /** What the Worker needs to verify the run; null if it started without a ticket (offline). */
  run: { ticket: RunTicket; inputs: number[] } | null;
};

const SAVE_ERRORS: Record<Exclude<SubmitResult, 'saved'>, string> = {
  'rate-limited': 'Too many scores at once. Try again in a minute.',
  duplicate: 'This run is already on the leaderboard.',
  expired: 'This run is too old to post now.',
  invalid: 'This run could not be verified, so it was not posted.',
  failed: 'Could not reach the leaderboard. Try again.',
};

/** Presses just after dying are ignored, so mashing jump doesn't skip the result. */
const RETRY_LOCK_MS = 500;
const JUMP_KEYS = new Set(['Space', 'ArrowUp', 'KeyW']);

function isFormControl(target: EventTarget | null): boolean {
  const tag = (target as HTMLElement | null)?.tagName;
  return tag === 'INPUT' || tag === 'BUTTON' || tag === 'TEXTAREA';
}

export default function JumpGame({ onExit, gameTheme, backgroundSet = 1 }: Props) {
  const profile = useProfile();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scoreRef = useRef<HTMLSpanElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const audioRef = useRef<GameAudio | null>(null);
  const overAtRef = useRef(0);
  /** A ticket fetched ahead of time, so starting a run never waits on the network. */
  const nextTicketRef = useRef<RunTicket | null>(null);
  const runTicketRef = useRef<RunTicket | null>(null);

  const [today] = useState(todayKey);
  const [phase, setPhase] = useState<Phase>('idle');
  const [mode, setMode] = useState<Mode>('endless');
  const [result, setResult] = useState<Result | null>(null);
  const [modal, setModal] = useState<'name' | 'board' | null>(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [shared, setShared] = useState(false);

  const best = mode === 'daily' ? dailyBestToday(profile) : profile.best;

  const handlePhase = useEffectEvent((next: Phase) => {
    setPhase(next);
    if (next === 'paused') audioRef.current?.setMusic(false);
    if (next !== 'over') return;

    const engine = engineRef.current;
    const score = engine?.score ?? 0;
    const before = getProfile().bestEver;
    const isBest = recordRun(mode, score);
    const unlocked = SKINS.filter((s) => s.unlockAt > before && s.unlockAt <= score).map((s) => s.name);
    const ticket = runTicketRef.current;
    overAtRef.current = performance.now();
    audioRef.current?.setMusic(false);
    setShared(false);
    setResult({
      score,
      zone: engine?.sim.zone ?? 0,
      isBest,
      unlocked,
      run: ticket && engine ? { ticket, inputs: engine.recording } : null,
    });
    if (isBest && score > 0) {
      setName(getProfile().name);
      setSaveError('');
      setModal('name');
    }
  });

  const handleScore = useEffectEvent((score: number) => {
    if (scoreRef.current) scoreRef.current.textContent = score.toLocaleString();
  });

  const handleSound = useEffectEvent((sound: 'jump' | 'death' | 'zone') => {
    const audio = audioRef.current;
    if (sound === 'zone') audio?.chime();
    else if (sound === 'death') {
      audio?.bonk();
      audio?.play('death');
    } else audio?.play(sound);
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const audio = new GameAudio(getProfile().muted);
    const engine = new Engine(
      canvas,
      {
        onPhase: (next) => handlePhase(next),
        onScore: (score) => handleScore(score),
        onSound: (sound) => handleSound(sound),
      },
      { baseSet: backgroundSet, baseTime: gameTheme, debug: window.location.search.includes('hitbox') },
    );
    engineRef.current = engine;
    audioRef.current = audio;
    // Layout is CSS; the engine only needs the canvas size.
    const observer = new ResizeObserver(() => engine.resize(canvas.clientWidth, canvas.clientHeight));
    observer.observe(canvas);
    engine.resize(canvas.clientWidth, canvas.clientHeight);
    return () => {
      observer.disconnect();
      engine.destroy();
      audio.dispose();
      engineRef.current = null;
      audioRef.current = null;
    };
  }, [backgroundSet, gameTheme]);

  useEffect(() => {
    let cancelled = false;
    loadSkinSheet(profile.skin)
      .then((sheet) => { if (!cancelled) engineRef.current?.setSheet(sheet); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [profile.skin, backgroundSet, gameTheme]);

  const fetchTicket = () => {
    requestRun().then((ticket) => { nextTicketRef.current = ticket; });
  };

  useEffect(fetchTicket, []);

  // Stop the page behind from scrolling.
  useEffect(() => {
    const { documentElement: html, body } = document;
    const previous = [html.style.overflow, body.style.overflow];
    html.style.overflow = body.style.overflow = 'hidden';
    return () => { [html.style.overflow, body.style.overflow] = previous; };
  }, []);

  const begin = (nextMode: Mode) => {
    const engine = engineRef.current;
    const audio = audioRef.current;
    if (!engine || !audio) return;
    audio.unlock();
    audio.setMusic(true);
    setMode(nextMode);
    setResult(null);
    setModal(null);
    const ticket = nextTicketRef.current;
    runTicketRef.current = ticket;
    nextTicketRef.current = null;
    fetchTicket();
    // Without a ticket (offline) the run still plays, it just can't be posted.
    const endlessSeed = ticket?.seed ?? (Math.random() * 2 ** 32) >>> 0;
    engine.start(nextMode === 'daily' ? dailySeed(today) : endlessSeed);
  };

  const resume = () => {
    engineRef.current?.resume();
    audioRef.current?.setMusic(true);
  };

  const backToMenu = () => {
    setResult(null);
    engineRef.current?.toMenu();
  };

  const toggleMute = () => {
    const muted = !getProfile().muted;
    updateProfile({ muted });
    audioRef.current?.setMuted(muted);
  };

  /** The one button: start, jump, resume or retry. */
  const pressAction = () => {
    if (modal) return;
    if (phase === 'running') engineRef.current?.press();
    else if (phase === 'paused') resume();
    else if (result) {
      if (performance.now() - overAtRef.current > RETRY_LOCK_MS) begin(mode);
    } else if (phase === 'idle') begin(mode);
  };

  const releaseAction = () => {
    engineRef.current?.release();
    // Phones only unlock sound once a touch ends.
    audioRef.current?.unlock();
  };

  const saveScore = async () => {
    const trimmed = name.trim();
    if (!trimmed || !result || saving) return;
    updateProfile({ name: trimmed });
    if (!result.run) {
      setSaveError('This run started offline, so it can’t be posted.');
      return;
    }
    setSaving(true);
    const outcome = await submitScore(result.run, trimmed, result.score, mode === 'daily' ? today : undefined);
    setSaving(false);
    if (outcome === 'saved') {
      setSaveError('');
      setModal('board');
    } else {
      setSaveError(SAVE_ERRORS[outcome]);
    }
  };

  const share = async () => {
    if (!result) return;
    const how = await shareRun({ mode, date: today, score: result.score, zone: result.zone });
    if (how === 'copied') setShared(true);
  };

  const onKeyDown = useEffectEvent((e: KeyboardEvent) => {
    if (e.code === 'Escape') {
      if (modal) setModal(null);
      else onExit();
      return;
    }
    if (modal || isFormControl(e.target)) return;
    if (JUMP_KEYS.has(e.code)) {
      e.preventDefault();
      if (!e.repeat) pressAction();
    } else if (e.code === 'Enter' && !e.repeat) {
      if (phase === 'idle' || result) pressAction();
    } else if (e.code === 'KeyP') {
      if (phase === 'running') engineRef.current?.pause();
      else if (phase === 'paused') resume();
    } else if (e.code === 'KeyM') {
      toggleMute();
    }
  });

  const onKeyUp = useEffectEvent((e: KeyboardEvent) => {
    if (JUMP_KEYS.has(e.code)) engineRef.current?.release();
  });

  useEffect(() => {
    const down = (e: KeyboardEvent) => onKeyDown(e);
    const up = (e: KeyboardEvent) => onKeyUp(e);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  const showMenu = phase === 'idle' && !result;
  const showOver = phase === 'over' && result;

  /** HUD buttons must not take focus, or Space would press them instead of jumping. */
  const hudButton = { type: 'button' as const, tabIndex: -1, onPointerDown: (e: React.PointerEvent) => e.preventDefault() };

  return (
    <div
      className="game-root"
      // The whole screen is the jump button, black bars included.
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest('button, a, input, [data-ui], .game-modal')) return;
        pressAction();
      }}
      onPointerUp={releaseAction}
      onPointerCancel={releaseAction}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="game-stage">
        <div className="game-screen">
          <canvas ref={canvasRef} className="game-canvas" width={VIEW_W} height={VIEW_H} />

          <div className="game-hud">
            <div className="game-score" style={{ visibility: phase === 'idle' ? 'hidden' : 'visible' }}>
              <span ref={scoreRef} className="game-score-now">0</span>
              <span className="game-score-best">Best {best.toLocaleString()}</span>
              {mode === 'daily' && <span className="game-tag">Daily run</span>}
            </div>
            <div className="game-buttons">
              <button {...hudButton} onClick={toggleMute} aria-label={profile.muted ? 'Turn sound on' : 'Turn sound off'}>
                {profile.muted ? <VolumeX aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
              </button>
              {phase === 'running' && (
                <button {...hudButton} onClick={() => engineRef.current?.pause()} aria-label="Pause">
                  <Pause aria-hidden="true" />
                </button>
              )}
              <button {...hudButton} onClick={onExit} aria-label="Exit game">
                <X aria-hidden="true" />
              </button>
            </div>
          </div>


          {showMenu && (
            <div className="game-panel">
              <h2 className="game-title">Ready?</h2>
              <div className="game-actions">
                <button type="button" className="btn-arcade" onClick={() => begin('endless')}>
                  <Play className="fill-current" aria-hidden="true" /> Endless
                </button>
                <button type="button" className="btn-arcade btn-arcade-alt" onClick={() => begin('daily')}>
                  <CalendarDays aria-hidden="true" /> Daily run
                </button>
              </div>
              <p className="game-help">
                Tap or press <kbd>Space</kbd> to jump. Hold for a higher jump.
                <br />
                The daily run is the same course for everyone, and it changes at midnight UTC.
              </p>
              <SkinPicker />
              <button type="button" className="game-link" onClick={() => setModal('board')}>
                <Trophy aria-hidden="true" /> Leaderboard
              </button>
            </div>
          )}

          {phase === 'paused' && (
            <div className="game-panel">
              <h2 className="game-title">Paused</h2>
              <div className="game-actions">
                <button type="button" className="btn-arcade" onClick={resume}>
                  <Play className="fill-current" aria-hidden="true" /> Resume
                </button>
                <button type="button" className="btn-arcade btn-arcade-alt" onClick={onExit}>Exit</button>
              </div>
            </div>
          )}

          {showOver && (
            <div className="game-panel">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="game-died" src="/game-assets/you_died.png" alt="You died" />
              <p className="game-final">
                {result.score.toLocaleString()}
                {result.isBest && result.score > 0 && <span className="game-tag">New best</span>}
              </p>
              {result.unlocked.length > 0 && (
                <p className="game-unlock">Skin unlocked: {result.unlocked.join(', ')}</p>
              )}
              <div className="game-actions">
                <button type="button" className="btn-arcade" onClick={() => begin(mode)}>
                  <RotateCcw aria-hidden="true" /> Again
                </button>
                <button type="button" className="btn-arcade btn-arcade-alt" onClick={backToMenu}>Menu</button>
              </div>
              <div className="game-links">
                <button type="button" className="game-link" onClick={() => setModal('board')}>
                  <Trophy aria-hidden="true" /> Leaderboard
                </button>
                <button type="button" className="game-link" onClick={share}>
                  <Share2 aria-hidden="true" /> {shared ? 'Copied!' : 'Share'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showMenu && !modal && (
        <p className="game-rotate-hint">
          <RotateCw aria-hidden="true" /> Turn your phone sideways to play
        </p>
      )}

      {/* Outside the rotated stage, so dialogs stay upright on a phone. */}
      {modal === 'name' && result && (
        <div className="game-modal">
          <form className="game-dialog" onSubmit={(e) => { e.preventDefault(); saveScore(); }}>
            <p className="eyebrow">{mode === 'daily' ? 'Daily run' : 'Endless'} · new best</p>
            <p className="game-dialog-score">{result.score.toLocaleString()}</p>
            <label className="sr-only" htmlFor="player-name">Your name</label>
            <input
              id="player-name"
              autoFocus
              type="text"
              maxLength={15}
              autoComplete="nickname"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            {saveError && <p className="game-error" role="alert">{saveError}</p>}
            <div className="game-actions">
              <button type="submit" className="btn-arcade btn-arcade-sm" disabled={saving || !name.trim()}>
                {saving ? 'Saving…' : 'Post score'}
              </button>
              <button type="button" className="game-link" onClick={() => setModal(null)}>Skip</button>
            </div>
          </form>
        </div>
      )}

      {modal === 'board' && (
        <div className="game-modal" onClick={(e) => { if (e.target === e.currentTarget) setModal(null); }}>
          <div className="game-dialog game-dialog-board">
            <ScoreBoard initialTab={mode === 'daily' ? 'daily' : 'all'}>
              <button type="button" className="btn-arcade btn-arcade-sm" onClick={() => setModal(null)}>Close</button>
            </ScoreBoard>
          </div>
        </div>
      )}
    </div>
  );
}
