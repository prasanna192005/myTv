export interface PlayerState {
  playing: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  videoName: string;
  lastUpdated: number;
  hasSubtitles?: boolean;
  subtitlesVisible?: boolean;
  mediaType?: 'video' | 'image';
}

export interface RemoteCommand {
  command: string;
  value?: any;
}

interface GlobalRemoteStore {
  commands: Record<string, RemoteCommand[]>;
  states: Record<string, PlayerState>;
  activeId: string | null;
}

const globalForRemote = global as unknown as {
  remoteStore: GlobalRemoteStore;
};

export const remoteStore = globalForRemote.remoteStore || {
  commands: {},
  states: {},
  activeId: null,
};

if (process.env.NODE_ENV !== 'production') {
  globalForRemote.remoteStore = remoteStore;
}
