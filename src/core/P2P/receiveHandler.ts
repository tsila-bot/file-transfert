// Auto download and persistence for received transfers
import { saveReceivedFile } from '@/core/storage/indexeddb';
import { useTransferStore } from '@/stores/transferStore';

// Register global handler once
if (typeof window !== 'undefined') {
    window.addEventListener('transfer:complete', async (ev: Event) => {
        try {
            const detail = (ev as CustomEvent).detail as { fileId: string; blob: Blob };
            const { fileId, blob } = detail;

            const transfer = useTransferStore.getState().getTransfer(fileId);
            const filename = transfer?.fileName || `${fileId}.bin`;

            // Persist the received file in IndexedDB for later retrieval
            try {
                await saveReceivedFile(fileId, filename, blob);
                console.log(`💾 Received file persisted: ${fileId}`);
            } catch (err) {
                console.warn('Failed to persist received file:', err);
            }

            // Try native file picker save if available
            if ('showSaveFilePicker' in window) {
                try {
                    // @ts-ignore
                    const handle = await (window as any).showSaveFilePicker({
                        suggestedName: filename,
                        types: [
                            {
                                description: 'All files',
                                accept: { '*/*': ['.*'] },
                            },
                        ],
                    });
                    const writable = await handle.createWritable();
                    await writable.write(blob);
                    await writable.close();
                    console.log('✅ File saved via showSaveFilePicker');
                    return;
                } catch (err) {
                    console.warn('Save via file picker failed or cancelled:', err);
                }
            }

            // Fallback: programmatic download
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            console.log('✅ File downloaded via anchor');
        } catch (error) {
            console.error('Error in transfer:complete handler', error);
        }
    });
}
