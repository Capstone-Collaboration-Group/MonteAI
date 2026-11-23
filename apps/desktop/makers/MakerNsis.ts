import path from 'node:path';
import { MakerBase, type MakerOptions } from '@electron-forge/maker-base';
import type { ForgePlatform } from '@electron-forge/shared-types';
import { Arch, Platform, build } from 'electron-builder';

/** Adds an assisted Windows .exe installer to Forge's existing Vite pipeline. */
export default class MakerNsis extends MakerBase<Record<string, never>> {
  name = 'nsis';
  defaultPlatforms: ForgePlatform[] = ['win32'];

  isSupportedOnCurrentPlatform(): boolean {
    return process.platform === 'win32';
  }

  async make({ dir, makeDir, targetArch }: MakerOptions): Promise<string[]> {
    if (targetArch !== 'x64' && targetArch !== 'arm64' && targetArch !== 'ia32') {
      throw new Error(`NSIS does not support the ${targetArch} architecture.`);
    }

    // Use Forge's already-packaged app, preserving its preload, ASAR and fuses.
    // Do not let electron-builder repackage the pnpm workspace or publish it.
    return build({
      projectDir: path.resolve(__dirname, '..'),
      prepackaged: dir,
      targets: Platform.WINDOWS.createTarget('nsis', Arch[targetArch]),
      publish: 'never',
      config: {
        appId: 'edu.cdm.monteskolar',
        productName: 'MonteSkolar',
        directories: { output: path.resolve(makeDir, 'nsis', targetArch) },
        artifactName: 'MonteSkolar-${version}-${arch}-Setup.${ext}',
        nsis: {
          oneClick: false,
          perMachine: false,
          allowToChangeInstallationDirectory: true,
          createDesktopShortcut: true,
          createStartMenuShortcut: true,
          shortcutName: 'MonteSkolar',
          uninstallDisplayName: 'MonteSkolar',
          deleteAppDataOnUninstall: false,
          runAfterFinish: true,
        },
      },
    });
  }
}
