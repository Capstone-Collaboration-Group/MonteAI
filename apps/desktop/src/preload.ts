// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

//
// Intentionally empty: the former thesis:approve IPC surface was removed
// when ingestion went metadata-only (the renderer calls POST /thesis/ingest
// directly through @monteai/api).


import './preload/backup';

