/** URLs dos instaladores Stadium Live (servidos em /downloads/stadium-live). */
export const STADIUM_LIVE_DOWNLOADS = [
  {
    id: 'linux',
    file: 'MLL-Stadium-Live-1.0.0-linux.deb',
    labelKey: 'club:stadium.downloadLinux',
    hintKey: 'club:stadium.downloadLinuxHint',
    icon: 'bi bi-ubuntu',
  },
  {
    id: 'windows',
    file: 'MLL-Stadium-Live-1.0.0-windows.exe',
    labelKey: 'club:stadium.downloadWindows',
    hintKey: 'club:stadium.downloadWindowsHint',
    icon: 'bi bi-windows',
  },
  {
    id: 'android',
    file: 'MLL-Stadium-Live-1.0.0-android-debug.apk',
    labelKey: 'club:stadium.downloadAndroid',
    hintKey: 'club:stadium.downloadAndroidHint',
    icon: 'bi bi-phone',
  },
] as const;

export function stadiumLiveDownloadUrl(file: string): string {
  return `/downloads/stadium-live/${encodeURIComponent(file)}`;
}
