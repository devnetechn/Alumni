export function validateFile(file, maxBytes) {
  if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
    return 'Please select an image or video file';
  }
  if (file.size > maxBytes) {
    return `File too large (max ${Math.round(maxBytes / (1024 * 1024))}MB)`;
  }
  return null;
}

export function resizeImage(file, { maxDim = 400, quality = 0.85 } = {}) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.onload = (ev) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Could not read image'));
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });
}

export function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.onload = (ev) => resolve(ev.target.result);
    reader.readAsDataURL(file);
  });
}
