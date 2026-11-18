// Post-processing for the Medium and High presets: subtle bloom (sun, lit
// windows, lamps, neon), a soft vignette, then tone mapping + sRGB output.
// The Low preset renders straight to the screen.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

const VignetteShader = {
  uniforms: { tDiffuse: { value: null }, uStrength: { value: 0.32 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uStrength; varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      float d = distance(vUv, vec2(0.5));
      c.rgb *= 1.0 - uStrength * smoothstep(0.35, 0.85, d);
      gl_FragColor = c;
    }`,
};

export class PostFX {
  constructor(renderer) {
    this.renderer = renderer;
    this.enabled = false;
    this.composer = null;
  }

  build() {
    const r = this.renderer;
    const size = r.getDrawingBufferSize(new THREE.Vector2());
    const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(r, target);
    this.renderPass = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.3, 0.55, 1.25); // threshold above sunlit paint: only lights and neon bloom
    this.vignette = new ShaderPass(VignetteShader);
    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.bloom);
    this.composer.addPass(this.vignette);
    this.composer.addPass(new OutputPass());
  }

  /** quality: 'low' | 'medium' | 'high' */
  setQuality(q) {
    this.enabled = q !== 'low';
    if (this.enabled && !this.composer) this.build();
    if (this.bloom) this.bloom.strength = q === 'high' ? 0.38 : 0.28;
  }

  setSize(w, h, pixelRatio) {
    if (!this.composer) return;
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(w, h);
  }

  render(scene, camera) {
    if (!this.enabled) return this.renderer.render(scene, camera);
    this.renderPass.scene = scene;
    this.renderPass.camera = camera;
    this.composer.render();
  }
}
