export class Assets {
  constructor() {
    this.images = {};
  }

  loadImage(key, src) {
    return new Promise(resolve => {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        this.images[key] = img;
        resolve(img);
      };
    });
  }

  get(key) {
    return this.images[key];
  }
}
