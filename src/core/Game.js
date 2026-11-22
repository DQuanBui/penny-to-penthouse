// Top-level orchestrator: renderer, city scene, player + camera, the sim state,
// UI overlays and the title / creator / play modes.
import * as THREE from 'three';
import { Events } from './Events.js';
import { Loop } from './Loop.js';
import { Input } from './Input.js';
import { Settings } from './Settings.js';
import { hourOf, calendar, fmtClock } from './Clock.js';
import { saveSlot, loadSlot, latestSlot, firstFreeSlot } from './SaveSystem.js';
import { BALANCE } from '../data/balance.js';
import { getCity } from '../data/cities/index.js';
import { HOME_BY_ID } from '../data/homes.js';
import { Sky } from '../world/Sky.js';
import { worldUniforms } from '../world/Buildings.js';
import { generateCity } from '../world/CityGenerator.js';
import { createRig } from '../characters/CharacterFactory.js';
import { loadGLBCharacters } from '../characters/GLBCharacters.js';
import { PlayerController } from '../characters/PlayerController.js';
import { ThirdPersonCamera } from '../characters/ThirdPersonCamera.js';
import { newState, migrate } from '../sim/State.js';
import { Sim } from '../sim/Sim.js';
import { installSystems } from '../sim/index.js';
import { CharacterCreator } from '../ui/CharacterCreator.js';
import { TitleScreen } from '../ui/TitleScreen.js';
import { HUD } from '../ui/HUD.js';
import { CityMap } from '../ui/Map.js';
import { Phone } from '../ui/Phone/Phone.js';
import { registerApps } from '../ui/Phone/apps.js';
import { openPause, openSlots, dialog } from '../ui/Menus.js';
import { h, btn } from '../ui/dom.js';
import { Interior, defaultHomeLayout, commercialLayout } from '../world/Interiors.js';
import { loadFurnitureModels } from '../build/FurnitureCatalog.js';
import { PLACE_TYPES } from '../data/placeTypes.js';
import { hasComputer } from '../data/items.js';
import { useFurniture } from '../ui/Interact.js';
import { computeObjective } from '../ui/Objectives.js';
import { Crowd } from '../characters/Crowd.js';
import { NPCManager } from '../characters/NPC.js';
import { openTalk } from '../ui/Talk.js';
import { BuildMode } from '../build/BuildMode.js';
import { PetFollower, ShelterDogs } from '../world/Pet.js';
import { ZooLife } from '../world/Zoo.js';
import { CampusLife } from '../world/Campus.js';
import { AirTraffic } from '../world/Airport.js';
import { BridgeLife, onWalkway } from '../world/Bridge.js';
import { SubwayLife, isRail, railKind } from '../world/Subway.js';
import { TimesSquareLife } from '../world/TimesSquare.js';
import { BeachLife } from '../world/Beach.js';
import { DuckLife } from '../world/Ducks.js';
import { LiveEvents } from '../world/LiveEvents.js';
import { SportsLife } from '../world/Sports.js';
import { SkateLife, makeBoard } from '../world/SkatePark.js';
import { StreetShows } from '../world/StreetShows.js';
import { Fireworks } from '../world/Fireworks.js';
import { BusRides } from '../ui/Bus.js';
import { PlaygroundLife } from '../world/Playground.js';
import { ClubQueues } from '../world/NightLife.js';
import { makeBike, makeMoto, helmet, OWN_BIKES, SHARE, SHARE_COLOR } from '../world/Bikes.js';
import { setUmbrella } from '../characters/Umbrella.js';
import { openEmotes, updateEmote, EMOTE_RATES } from '../ui/Emotes.js';
import { openService } from '../ui/Shops.js';
import { openPet } from '../ui/Pets.js';
import { PhotoMode } from '../ui/PhotoMode.js';
import { shopOpen, opensAt } from '../data/shops.js';
import { Weather } from '../world/Weather.js';
import { openStation } from '../world/Transit.js';
import { CitySelect } from '../ui/CitySelect.js';
import { Tutorial } from '../ui/Tutorial.js';
import { openLifeEvent } from '../ui/EventDialog.js';
import { recordHallOfFame } from '../sim/Rankings.js';
import { VehicleManager, loadVehicleModels } from '../world/Vehicles.js';
import { Traffic } from '../world/Traffic.js';
import { Animals } from '../world/Animals.js';
import { StreetLife } from '../world/StreetLife.js';
import { CityEvents } from '../world/CityEvents.js';
import { VEHICLE_BY_ID } from '../data/vehicles.js';
import { PostFX } from './PostFX.js';
import { pushOutOBB } from '../world/Collision.js';
import { AudioEngine } from '../audio/AudioEngine.js';
import { fmtMoney, dampAngle } from './utils.js';

const PIXEL_RATIO = { low: 0.8, medium: 1.25, high: 2 };
const BIKE_RIDE = { rates: { fun: 3, health: 0.6 } };
const SIT_REST = { rates: { fun: 6, energy: 3.5, social: 1.5 } };
const SUNBATHE = { rates: { fun: 8, energy: 4 } };
const SWIM = { rates: { fun: 9, health: 3, energy: -6, hygiene: 2 } };

export class Game {
  constructor() {
    this.events = new Events();
    this.settings = new Settings(this.events);
    this.canvas = document.getElementById('game');
    this.ui = document.getElementById('ui');
    this.fadeEl = document.getElementById('fade');

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    this.postfx = new PostFX(this.renderer);
    this.audio = new AudioEngine(this);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.15, 3200);
    this.sky = new Sky(this.scene);
    this.input = new Input(this.canvas);
    this.player = new PlayerController();
    this.cam = new ThirdPersonCamera(this.camera);
    this.player.onStep = () => this.audio.play(this.inside ? 'stepIn' : 'step');
    if (import.meta.env.DEV) import('../ui/Debug.js').then((m) => m.installDebug(this));

    // Three real lights hop between the street lamps nearest the player.
    this.lampLights = [];
    for (let i = 0; i < 3; i++) {
      const l = new THREE.PointLight('#ffc37a', 0, 26, 1.6);
      this.scene.add(l);
      this.lampLights.push(l);
    }
    this._lampTimer = 0;

    this.interior = new Interior();
    this.crowd = new Crowd(this.scene);
    this.npcs = new NPCManager(this);
    this.build = new BuildMode(this);
    this.weather = new Weather(this.scene, this.sky);
    this.vehicles = new VehicleManager(this);
    this.traffic = new Traffic(this.scene);
    this.traffic.onStop = (x, z) => {
      const p = this.player.pos;
      if (!this.inside && (x - p.x) ** 2 + (z - p.z) ** 2 < 35 * 35) this.audio?.play('hiss');
    };
    this.animals = new Animals(this.scene);
    this.streetLife = new StreetLife(this);
    this.cityEvents = new CityEvents(this);
    this.animals.onScare = () => this.audio.play('flap');
    this.pet = new PetFollower();
    this.pet.attach(this.scene);
    this.shelterDogs = new ShelterDogs();
    this.zooLife = new ZooLife(this);
    this.campusLife = new CampusLife(this);
    this.airTraffic = new AirTraffic(this);
    this.bridgeLife = new BridgeLife(this);
    this.subway = new SubwayLife(this);
    this.timesSquare = new TimesSquareLife(this);
    this.beachLife = new BeachLife(this);
    this.ducks = new DuckLife(this);
    this.liveEvents = new LiveEvents(this);
    this.sports = new SportsLife(this);
    this.skate = new SkateLife(this);
    this.shows = new StreetShows(this);
    this.fireworks = new Fireworks(this);
    this.bus = new BusRides(this);
    this.playground = new PlaygroundLife(this);
    this.clubs = new ClubQueues(this);
    this.events.on('petChanged', () => this.syncPet());
    this.events.on('carBought', () => this.vehicles.sync());
    this.events.on('carSold', () => this.vehicles.sync());
    this.tutorial = new Tutorial(this);
    // HUD objective sources (see ui/Objectives.js)
    this.objectiveOverride = () => this.tutorial.objective();
    this.goalObjective = () => {
      const g = this.sim.goals.current();
      return g ? [`Goal: ${g.def.name}`, `${Math.round(g.pct * 100)}% there. Open Goals on your phone for details.`] : null;
    };
    this.inside = null; // { place, home, layout } while in an interior
    this._focus = new THREE.Vector3();
    this._winColor = new THREE.Color();

    this.mode = 'boot';
    this.city = null;
    this.state = null;
    this.sim = null;
    this.slot = 1;
    this.overlays = [];
    this.interactable = null;
    this.titleTime = 18.75;
    this.lowFpsTime = 0;

    this.fpsEl = h('div.fps.hidden');
    this.ui.append(this.fpsEl);
    this.map = new CityMap(this);
    this.hud = new HUD(this);
    this.photoMode = new PhotoMode(this);
    this.phone = new Phone(this);
    registerApps(this.phone, this);

    this.applySettings();
    this.events.on('settings', () => this.applySettings());
    this.events.on('newday', () => this.settings.get('autosave') && this.saveNow(true));
    this.events.on('collapse', (c) => this.onCollapse(c));
    this.events.on('homeChanged', () => this.onHomeChanged());
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('blur', () => this.mode === 'play' && !this.overlays.length && openPause(this));
    window.addEventListener('beforeunload', () => this.mode === 'play' && this.saveNow(true));
    this.resize();

    this.loop = new Loop((dt, t) => this.update(dt, t));
  }

  // ------------------------------------------------------------- settings
  get quality() {
    return this.settings.get('graphics');
  }

  applySettings() {
    const s = this.settings;
    const q = s.get('graphics');
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, PIXEL_RATIO[q] || 1));
    this.renderer.shadowMap.enabled = q !== 'low';
    this.postfx.setQuality(q);
    this.sky.setQuality(q);
    if (this.city && this._crowdQ !== q) {
      this.crowd.setCity(this.city, q);
      this.traffic.setCity(this.city, q);
      this.animals.setCity(this.city, q);
    }
    this._crowdQ = q;
    this.cam.sensitivity = s.get('sensitivity');
    this.cam.invertY = s.get('invertY');
    this.input.cameraMode = s.get('cameraMode');
    this.fpsEl.classList.toggle('hidden', !s.get('showFps'));
    document.documentElement.style.setProperty('--ui-scale', s.get('uiScale'));
    this.resize();
  }

  resize() {
    const w = window.innerWidth;
    const hgt = window.innerHeight;
    this.renderer.setSize(w, hgt, false);
    this.postfx.setSize(w, hgt, this.renderer.getPixelRatio());
    this.camera.aspect = w / hgt;
    this.camera.updateProjectionMatrix();
    this.creator?.onResize(w, hgt);
    if (this.build?.active) this.build.resize();
  }

  /** Draw a frame (through post-processing on Medium/High). */
  draw(scene, camera) {
    this.postfx.render(scene, camera);
  }

  /** Fade to black, run fn (may be async), fade back. */
  async fade(fn) {
    this.fading = true;
    this.fadeEl.classList.add('on');
    await new Promise((r) => setTimeout(r, 300));
    try {
      await fn();
    } finally {
      await new Promise((r) => setTimeout(r, 80));
      this.fadeEl.classList.remove('on');
      this.fading = false;
    }
  }

  // ------------------------------------------------------------- overlays
  /** Blocking UI layers (phone, menus, dialogs, shops). They pause the clock. */
  openOverlay(el, opts = {}) {
    this.ui.append(el);
    this.overlays.push({ el, ...opts });
    this.input.gameplay = false;
    this.input.releaseLock();
    return el;
  }
  closeOverlay(el) {
    const i = this.overlays.findIndex((o) => o.el === el);
    if (i < 0) return;
    const [o] = this.overlays.splice(i, 1);
    o.el.remove();
    o.onClose?.();
    this.input.gameplay = this.mode === 'play' && !this.overlays.length;
  }
  closeTop() {
    const o = this.overlays[this.overlays.length - 1];
    if (o && o.closable !== false) this.closeOverlay(o.el);
  }
  closeAllOverlays() {
    while (this.overlays.length) this.closeOverlay(this.overlays[this.overlays.length - 1].el);
  }

  // ---------------------------------------------------------------- world
  loadCity(cityId, season) {
    if (this.city && this.city.cfg.id === cityId && this.city.season === season) return this.city;
    if (this.city) {
      this.scene.remove(this.city.group);
      this.city.dispose();
    }
    const cfg = getCity(cityId);
    this.city = generateCity(cfg, { season });
    this.city.season = season;
    this.scene.add(this.city.group);
    this.map.setCity(this.city);
    this.crowd.setCity(this.city, this.quality);
    this.npcs.setCity(this.city);
    this.traffic.setCity(this.city, this.quality);
    this.animals.setCity(this.city, this.quality);
    this.streetLife.setCity(this.city);
    this.zooLife.setCity(this.city);
    this.campusLife.setCity(this.city);
    this.airTraffic.setCity(this.city);
    this.bridgeLife.setCity(this.city);
    this.timesSquare.setCity(this.city);
    this.beachLife.setCity(this.city);
    this.ducks.setCity(this.city);
    this.liveEvents.setCity(this.city);
    this.sports.setCity(this.city);
    this.skate.setCity(this.city);
    this.shows.setCity(this.city);
    this.fireworks.setCity(this.city);
    this.playground.setCity(this.city);
    this.clubs.setCity(this.city);
    this.cityEvents.setCity(this.city);
    this.vehicles.clear();
    if (this.state) this.vehicles.sync();
    return this.city;
  }

  /** Trees and lawns follow the calendar: rebuild the city when the season turns. */
  checkSeason() {
    const season = calendar(this.state.time.total).seasonId;
    if (!this.city || this.city.season === season || this.overlays.length || this.fading) return;
    const swap = () => {
      this.loadCity(this.state.trip?.cityId || this.state.cityId, season);
      if (!this.inside) {
        const w = this.cityWorld();
        this.player.setWorld(w);
        this.cam.setWorld(w);
      }
    };
    if (this.inside) swap();
    else this.fade(swap).then(() => this.events.emit('toast', { icon: { spring: '🌸', summer: '☀️', fall: '🍂', winter: '❄️' }[season], title: `${season[0].toUpperCase() + season.slice(1)} has arrived`, text: 'A new season in the city.', kind: 'info' }));
  }

  cityWorld() {
    return { colliders: this.city.colliders, groundY: this.city.groundY, obstacles: (pos, r, y) => this.pushOutOfMovers(pos, r, y) };
  }

  /**
   * Things that move or get parked: the player cannot walk through cars or
   * people. Returns true when the player was pushed.
   */
  pushOutOfMovers(pos, r, y) {
    let hit = false;
    if (y < 1.5) {
      for (const o of this.vehicles.parkedOBBs()) if (pushOutOBB(pos, r, o)) hit = true;
      for (const o of this.liveEvents.obbs()) if (pushOutOBB(pos, r, o)) hit = true;
      if (this.traffic.pushOut(pos, r)) hit = true;
    }
    // pedestrians: soft circles
    const cr = this.crowd;
    const rr = r + 0.28;
    for (let i = 0; i < cr.n; i++) {
      if (!cr.alive[i]) continue;
      const dx = pos.x - cr.x[i];
      const dz = pos.z - cr.z[i];
      const d2 = dx * dx + dz * dz;
      if (d2 >= rr * rr || d2 < 1e-6) continue;
      const d = Math.sqrt(d2);
      pos.x += (dx / d) * (rr - d);
      pos.z += (dz / d) * (rr - d);
      hit = true;
    }
    for (const a of this.npcs.out.values()) {
      const p = a.rig.group.position;
      const dx = pos.x - p.x;
      const dz = pos.z - p.z;
      const d2 = dx * dx + dz * dz;
      if (d2 >= rr * rr || d2 < 1e-6) continue;
      const d = Math.sqrt(d2);
      pos.x += (dx / d) * (rr - d);
      pos.z += (dz / d) * (rr - d);
      hit = true;
    }
    if (this.zooLife.blockPlayer(pos)) hit = true;
    return hit;
  }

  setPlayerLook(appearance) {
    const parent = this.playerRig ? this.playerRig.group.parent : this.scene;
    if (this.playerRig) {
      parent?.remove(this.playerRig.group);
      this.playerRig.dispose();
    }
    this.playerRig = createRig(appearance);
    (parent || this.scene).add(this.playerRig.group);
    if (this.bikeMesh) this.playerRig.group.add(this.bikeMesh);
    this.player.setRig(this.playerRig);
  }

  /** Staying at this city's hotel tonight (on a trip, or a booked night)? */
  hotelAccess() {
    const st = this.state;
    return st.trip?.cityId === this.city.cfg.id || (st.flags.hotelUntil || 0) > st.time.total;
  }

  enterHotelRoom(place) {
    this.enterPlace(place);
  }

  /** Fly to another city (or back home): a short flight card, then the new city. */
  async travelTo(cityId, minutes) {
    const st = this.state;
    this.closeAllOverlays();
    this.photoMode.toggle(false);
    const dest = getCity(cityId);
    const card = h('div.travel-card', h('div.travel-plane', '✈️'), h('div.travel-title', cityId === st.cityId ? `Flying home to ${dest.name}` : `Flying to ${dest.name}`), h('div.travel-sub', `${Math.floor(minutes / 60)}h ${minutes % 60}m · window seat · snacks served`));
    this.ui.append(card);
    await this.fade(async () => {
      await new Promise((r) => setTimeout(r, 1500));
      if (this.vehicles.driving) this.vehicles.exit(true);
      this.leaveInterior(true);
      this.sim.advance(minutes, { noCollapse: true });
      (st.stats.citiesVisited ||= {})[st.cityId] = 1;
      st.stats.citiesVisited[cityId] = 1;
      st.stats.flights = (st.stats.flights || 0) + 1;
      st.trip = cityId === st.cityId ? null : { cityId, since: this.sim.day };
      this.loadCity(cityId, calendar(st.time.total).seasonId);
      this.npcs.clearOutdoor();
      const w = this.cityWorld();
      this.player.setWorld(w);
      this.cam.setWorld(w);
      this.placePlayerAt(this.city.placeById.airport || this.homePlace());
      this.syncPet();
      this.map.setWaypoint(st.trip ? this.city.placeById.hotel : this.homePlace());
    });
    card.remove();
    this.events.emit('toast', st.trip ? { icon: '🛬', title: `Welcome to ${dest.name}!`, text: `Your room is booked at ${this.city.placeById.hotel?.name}. Follow the waypoint. Fly home from the airport any time.`, kind: 'good', long: true } : { icon: '🏠', title: 'Home sweet home', text: `Back in ${dest.name}.`, kind: 'good' });
    this.saveNow(true);
  }

  homePlace() {
    if (this.state?.trip && this.city.placeById.hotel) return this.city.placeById.hotel;
    return this.city.placeById['home_' + this.state.home.districtId] || this.city.places.find((p) => p.type === 'home');
  }

  /** Stand the player outside a place's door, facing the street. */
  placePlayerAt(place) {
    this.player.sitting = false;
    this.player.emote = null;
    if (this.player.riding) this.dismountBike(false);
    const ry = Math.atan2(place.nx, place.nz);
    this.player.teleport(place.x, place.z, ry);
    this.cam.snapBehind(ry + 1.1);
  }

  playerMapPos() {
    if (this.inside) return { x: this.inside.place.x, z: this.inside.place.z, heading: Math.atan2(this.inside.place.nx, this.inside.place.nz) };
    return { x: this.player.pos.x, z: this.player.pos.z, heading: this.player.heading };
  }

  locationLabel() {
    if (this.inside) return this.inside.home ? `Home · ${this.inside.place.district.name}` : this.inside.place.name;
    const d = this.city.districtAt(this.player.pos.x, this.player.pos.z);
    return `${this.weather.info.icon} ${d.name}, ${this.city.cfg.name}`;
  }

  /** What the Social app can post about from where the player stands. */
  postContext() {
    const inside = this.inside;
    let landmark = null;
    if (!inside) {
      const p = this.player.pos;
      for (const l of this.city.landmarks) if ((l.x - p.x) ** 2 + (l.z - p.z) ** 2 < 55 * 55) landmark = l.name;
    }
    return { landmark, inHome: !!inside?.home, inFoodPlace: !!inside && ['cafe', 'restaurant', 'bar'].includes(inside.place.type) };
  }

  // ------------------------------------------------------------ interiors
  /** Walk through a door: fade into the place's interior scene. */
  enterPlace(place, instant) {
    if (this.player.riding) this.dismountBike(place.type === 'station');
    // rail cities: go down (or up) to the platform; bus cities: the stop's timetable
    if (place.station && !isRail(this.city.cfg)) return this.useStation(place);
    if (place.station) place.rail = railKind(this.city.cfg);
    if (place.outdoor) return this.zooLife.openBooth(place);
    // the hotel: guests go up to their room, everyone else books at the front desk
    if (place.type === 'hotel' && !this.hotelAccess()) return openService(this, place);
    const go = () => {
      const st = this.state;
      const home = place.type === 'home';
      const layout = home ? (st.home.layout ||= defaultHomeLayout(st.home.type)) : commercialLayout(place);
      if (home && st.home.owned) {
        // an owned home's layout is stored on the property too
        const prop = st.properties.find((p) => p.id === st.home.propertyId);
        if (prop) prop.layout = layout;
      }
      this.interior.build(layout, { place, home, hasPc: hasComputer(st) });
      this.inside = { place, home, layout, level: 0 };
      this.npcs.populateInterior(this.interior, place);
      this.subway.attach(this.interior, place);
      this.interior.scene.add(this.playerRig.group);
      this.player.setWorld(this.interior.world);
      this.cam.setWorld(this.interior.world);
      this.player.teleport(layout.doorX, layout.d - 1.1, Math.PI);
      this.cam.snapBehind(Math.PI);
      this.cam.pitch = 0.55;
      if (this.pet.active) {
        if (home || place.type === 'shelter') {
          this.pet.attach(this.interior.scene);
          this.pet.place(layout.doorX + 0.7, layout.d - 1.6, Math.PI);
          this.pet.mode = 'follow';
        } else {
          // dogs wait outside shops, sitting beside the door
          this.pet.waitAt(place.x + place.nz * 0.9 + place.nx * 0.2, place.z - place.nx * 0.9 + place.nz * 0.2, Math.atan2(-place.nx, -place.nz));
        }
      }
      if (place.type === 'shelter') this.shelterDogs.show(this.interior.scene, this.sim.pets.available(), [1.2, 1.8, 7.4, 5.0]);
      this._outDist = this.cam.dist;
      this.cam.dist = Math.min(this.cam.dist, 5);
      this.cam.maxDist = 9;
      this.audio?.play('door');
      this.events.emit('entered', { place, home });
      if (home) this.hud.hint('home', 'This is your place. Walk up to furniture and press E: bed to sleep, fridge to eat, shower to wash.', 9);
      else if (place.station) this.hud.hint('platform', 'Wait behind the yellow line. When the train stops and opens its doors, press E to board.', 8);
      else if (PLACE_TYPES[place.type].service) this.hud.hint('counter', 'Walk up to the counter and press E to be served.', 7);
      if (home) this.hud.hint('buildkey', 'Press B at home to furnish and decorate in build mode.', 8);
    };
    if (instant) go();
    else this.fade(go);
  }

  /** Rebuild the current interior (after furniture or ownership changes). */
  refreshInterior() {
    if (!this.inside) return;
    const { place, home } = this.inside;
    const layout = home ? (this.state.home.layout ||= defaultHomeLayout(this.state.home.type)) : this.inside.layout;
    this.inside.layout = layout;
    this.npcs.clearIndoor();
    this.interior.build(layout, { place, home, hasPc: hasComputer(this.state), level: this.inside.level || 0 });
    this.npcs.populateInterior(this.interior, place);
    this.player.setWorld(this.interior.world);
    this.cam.setWorld(this.interior.world);
  }

/** Walked to the top (or bottom) of a staircase: arrive on the other floor and keep going. */
  useStairs(to) {
    const L = this.inside.layout;
    const S = L.stairs;
    this.inside.level = to;
    this.refreshInterior();
    const xc = (S.x0 + S.x1) / 2;
    if (to === 1) {
      this.player.teleport(xc, S.zTop - 0.55, Math.PI);
      this.cam.snapBehind(Math.PI);
    } else {
      // partway down the flight, still walking down
      this.player.teleport(xc, S.zBot - (S.zBot - S.zTop) * 0.45, 0);
      this.cam.snapBehind(0);
    }
    this.hud.hint('stairs', to ? 'Upstairs! Walk back down through the opening to go down.' : 'Back on the ground floor.', 4);
  }

  /** Two-storey homes: ride the lift pad to the other floor. */
  switchFloor() {
    this.fade(() => {
      this.inside.level = this.inside.level ? 0 : 1;
      this.refreshInterior();
      const L = this.inside.layout;
      this.player.teleport(L.w - 0.8, L.d - 2.0, Math.PI);
      this.cam.snapBehind(Math.PI);
      if (this.pet.active && this.pet.mesh.parent === this.interior.scene) this.pet.heel(this.player);
    });
  }

  leaveInterior(silent) {
    if (!this.inside) return;
    if (this.build.active) this.build.exit();
    const place = this.inside.place;
    const out = () => {
      this.scene.add(this.playerRig.group);
      const w = this.cityWorld();
      this.player.setWorld(w);
      this.cam.setWorld(w);
      this.cam.maxDist = 16;
      this.cam.dist = this._outDist || 6.5;
      this.inside = null;
      this.npcs.clearIndoor();
      this.placePlayerAt(place);
      this.shelterDogs.clear();
      if (this.pet.active) {
        const waiting = this.pet.mode === 'wait';
        this.pet.attach(this.scene);
        // a waiting dog trots over from the door; one that came inside walks out with you
        if (waiting) this.pet.mode = 'follow';
        else this.pet.heel(this.player);
      }
      this.events.emit('left', { place });
    };
    if (silent) out();
    else {
      this.audio?.play('door');
      this.fade(out);
    }
  }

  useStation(place) {
    openStation(this, place);
  }

  // ----------------------------------------------------------------- flow
  async start() {
    this.loop.start();
    await Promise.all([loadGLBCharacters(), loadFurnitureModels(), loadVehicleModels()]); // optional models; resolve immediately when none exist
    const latest = latestSlot();
    const st = latest ? loadSlot(latest) : null;
    this.loadCity(st?.cityId || 'newyork', 'summer');
    this.toTitle();
  }

  toTitle() {
    this.closeAllOverlays();
    this.leaveInterior(true);
    this.hud.show(false);
    this.input.gameplay = false;
    if (this.playerRig) this.playerRig.group.visible = false;
    this.npcs.clearOutdoor();
    this.vehicles.exit(true);
    this.vehicles.clear();
    this.crowd.group.visible = false;
    this.animals.group.visible = false;
    this.streetLife.clear();
    this.cityEvents.clear();
    this.pet.setPet(null);
    this.shelterDogs.clear();
    this.photoMode.toggle(false);
    this.player.riding = null;
    this.bikeMesh?.removeFromParent();
    this.bikeMesh = null;
    this.player.sitting = false;
    this.state = null;
    this.sim = null;
    this.title?.close();
    this.title = new TitleScreen(this);
    this.sky.overcast = this.sky.fogBoost = 0;
    this.sky.tint.set('#ffffff');
    this.weather.rain.visible = this.weather.snow.visible = false;
    this.mode = 'title';
  }

  /** New Life: choose a slot, then the creator. */
  newLife() {
    const free = firstFreeSlot();
    const go = (slot) => {
      this.slot = slot;
      this.fade(() => this.openCreator());
    };
    if (free) go(free);
    else openSlots(this, 'new', go);
  }

  openCreator(initial) {
    this.title?.close();
    this.title = null;
    this.closeAllOverlays();
    this.input.gameplay = false;
    this.creator = new CharacterCreator(
      this,
      (profile) => this.fade(() => this.openCitySelect(profile)),
      () =>
        this.fade(() => {
          this.closeCreator();
          this.toTitle();
        }),
      initial,
    );
    this.creator.onResize(window.innerWidth, window.innerHeight);
    this.mode = 'creator';
  }
  /** After the creator: compare the five cities over a live skyline. */
  openCitySelect(profile) {
    this.closeCreator();
    this.mode = 'cityselect';
    this.citySelect = new CitySelect(
      this,
      (cityId) =>
        this.fade(() => {
          this.citySelect.close();
          this.citySelect = null;
          this.beginLife(profile, cityId);
        }),
      () =>
        this.fade(() => {
          this.citySelect.close();
          this.citySelect = null;
          this.openCreator(profile);
        }),
    );
  }

  closeCreator() {
    this.creator?.close();
    this.creator = null;
  }

  beginLife(profile, cityId) {
    this.closeCreator();
    const cfg = getCity(cityId);
    const state = newState(profile, cfg);
    this.setupLife(state);
    this.placePlayerAt(this.homePlace());
    this.saveNow(true);
    // wake up in your rented room, next to the bed
    this.enterPlace(this.homePlace(), true);
    const bed = this.interior.points.find((p) => p.use === 'sleep');
    if (bed) this.player.teleport(bed.x, bed.z, 0.6);
    this.events.emit('lifeStarted', {});
    this.tutorial.offer();
  }

  loadGame(slot) {
    const raw = loadSlot(slot);
    if (!raw) return;
    this.fade(() => {
      this.slot = slot;
      const state = migrate(raw, getCity(raw.cityId));
      this.setupLife(state);
      const p = state.pos;
      if (p && p.x != null) {
        this.player.teleport(p.x, p.z, p.heading || 0);
        this.cam.snapBehind((p.heading || 0) + 0.6);
      } else this.placePlayerAt(this.homePlace());
      this.events.emit('lifeLoaded', {});
    });
  }

  /** Shared by new and loaded games: city, sim, player, HUD. */
  setupLife(state) {
    this.title?.close();
    this.title = null;
    this.closeAllOverlays();
    this.leaveInterior(true);
    this.state = state;
    const season = calendar(state.time.total).seasonId;
    this.loadCity(state.trip?.cityId || state.cityId, season);
    // the sim (prices, rent, rankings) always belongs to your home city
    this.sim = new Sim(state, this.events, getCity(state.cityId));
    installSystems(this.sim);
    this.vehicles.clear();
    this.vehicles.sync();
    this.npcs.clearOutdoor();
    this.crowd.group.visible = true;
    this.setPlayerLook(state.profile.appearance);
    this.playerRig.group.visible = true;
    const w = this.cityWorld();
    this.player.setWorld(w);
    this.cam.setWorld(w);
    if (state.flags.bikeShare) {
      // you were riding a CityCycle when the game was saved: it was returned for you
      state.flags.bikeShare = null;
      this.events.emit('toast', { icon: '🚲', title: 'CityCycle returned', text: 'Your bike-share ride ended when you left. It was docked for you.', kind: 'info' });
    }
    this.pet.setPet(state.pet || null);
    this.pet.attach(this.scene);
    this.pet.heel(this.player);
    this.hud.cashShown = null;
    this.hud.show(true);
    this.mode = 'play';
    this.input.gameplay = true;
    this.hud.hint('move', 'WASD to move · Shift to run · drag the mouse to look around · Tab opens your phone', 10);
  }

  saveMeta() {
    return { netWorth: Math.round(this.sim.finance.netWorth()), job: this.sim.jobs?.title() || '', popularity: Math.round(this.state.social.popularity) };
  }

  saveNow(quiet) {
    if (!this.state || this.mode !== 'play') return;
    const p = this.player.pos;
    const dr = this.vehicles.driving;
    if (dr) dr.v.pos = { x: dr.group.position.x, z: dr.group.position.z, ry: dr.group.rotation.y };
    // inside a building the save point is the pavement outside its door
    this.state.pos = this.inside ? { x: this.inside.place.x, z: this.inside.place.z, heading: Math.atan2(this.inside.place.nx, this.inside.place.nz) } : { x: p.x, z: p.z, heading: this.player.heading };
    const ok = saveSlot(this.slot, this.state, this.saveMeta());
    recordHallOfFame(this.state, this.sim.rankings.me());
    if (!quiet) this.events.emit('toast', ok ? { icon: '💾', title: 'Game saved', text: `Slot ${this.slot}`, kind: 'good' } : { icon: '⚠️', title: 'Save failed', text: 'Browser storage is unavailable.', kind: 'bad' });
    this.events.emit('slotsChanged');
  }

  onCollapse(c) {
    if (this.sim?.headless) return;
    const text =
      c.kind === 'hospital'
        ? `Your health gave out. You spent ${c.hours} hours in hospital.`
        : c.kind === 'hunger'
          ? 'You fainted from hunger and woke up in the ER.'
          : 'You collapsed from exhaustion and woke up in the ER.';
    this.fade(() => {
      this.closeAllOverlays();
      this.vehicles.exit(true);
      this.leaveInterior?.(true);
      const hosp = this.city.placeById.hospital || this.homePlace();
      this.placePlayerAt(hosp);
      dialog(this, {
        title: c.kind === 'hospital' ? '🏥 Hospitalised' : '🚑 You collapsed',
        body: h('div', h('p', text), h('p.bad', `Medical bill: ${fmtMoney(c.bill)}`), h('p.muted', 'Keep an eye on your needs — hover the mood ring in the top right.')),
        buttons: [btn('OK', () => this.closeTop(), 'primary')],
      });
    });
  }

  /** The player moved (or was evicted): show them their new front door. */
  onHomeChanged() {
    if (this.mode !== 'play') return;
    const wasHome = this.inside?.home;
    this.fade(() => {
      this.closeAllOverlays();
      if (wasHome) this.leaveInterior(true);
      if (wasHome || !this.inside) this.placePlayerAt(this.homePlace());
    });
  }

  /** Show (or hide) the player's dog beside them, in whichever scene they are in. */
  syncPet() {
    const pet = this.state?.pet || null;
    this.pet.setPet(pet);
    if (!pet) return;
    this.pet.attach(this.inside ? this.interior.scene : this.scene);
    this.pet.heel(this.player);
  }

  /** The bridge lookout: the skyline, the water, the boats... */
  enjoyView(br) {
    const sim = this.sim;
    const night = this.sky.night > 0.5;
    this.fade(() => {
      sim.advance(25, { noCollapse: true });
      sim.state.needs.fun = Math.min(100, sim.state.needs.fun + 14);
      sim.state.needs.social = Math.min(100, sim.state.needs.social + 3);
      sim.state.stats.bridgeViews = (sim.state.stats.bridgeViews || 0) + 1;
    });
    this.events.emit('toast', { icon: '🌉', title: br.name, text: night ? 'The skyline glitters across the water. The cables glow like strings of pearls.' : 'Wind off the water, gulls overhead, the whole skyline laid out in front of you.', kind: 'good', long: true });
  }

  // ---- bicycles ----------------------------------------------------------------------
  /** Hop on a bike: 'share' (rented at a dock) or your own model. */
  mountBike(kind) {
    if (this.player.riding || this.inside || this.vehicles.driving) return;
    const def = kind === 'share' ? { ...SHARE, color: SHARE_COLOR, name: 'CityCycle' } : OWN_BIKES[kind] || OWN_BIKES.cruiser;
    this.player.sitting = false;
    this.player.riding = { max: def.max, accel: def.accel, v: 0, kind, effort: def.effort ?? 1, moto: def.moto || null, skate: !!def.skate, hop: 0 };
    this.bikeMesh = def.skate ? makeBoard(def.color) : def.moto ? makeMoto(def.moto, def.color) : makeBike(def.color);
    this.playerRig.group.add(this.bikeMesh);
    if (def.moto && this.playerRig.bones?.head) this.playerRig.bones.head.add((this.helmetMesh = helmet(def.color)));
    this.audio?.play(def.moto ? 'bump' : 'click');
    if (def.skate) this.hud.hint('skate', 'Skating: W push · S slow down · A/D carve · Space to ollie. Ride up the quarter pipes at the skate park! G (or E) to step off.', 9);
    else if (def.moto) this.hud.hint('moto', 'On your ' + def.name.toLowerCase() + ': W throttle · S brake · A/D steer. Press G (or E) to get off. Watch the traffic!', 9);
    else this.hud.hint('bike', 'On the bike: W pedal · S brake · A/D steer. Press G (or E) to get off.', 9);
  }

  /** Get off the bike. A rented one is charged by time when docked. */
  dismountBike(atDock = false) {
    const R = this.player.riding;
    if (!R) return;
    this.player.riding = null;
    this.bikeMesh?.removeFromParent();
    this.bikeMesh = null;
    this.helmetMesh?.removeFromParent();
    this.helmetMesh = null;
    const st = this.state;
    if (R.kind === 'share' && st.flags.bikeShare) {
      const pi = this.sim.city.priceIndex || 1;
      const mins = st.time.total - st.flags.bikeShare.start;
      const extra = Math.max(0, Math.ceil((mins - SHARE.includedMin) / 15)) * SHARE.per15 * pi;
      const stray = atDock ? 0 : SHARE.strayFee * pi;
      if (extra + stray > 0) this.sim.finance.charge(Math.round((extra + stray) * 100) / 100, 'transit', 'CityCycle ride');
      st.flags.bikeShare = null;
      st.stats.bikeRides = (st.stats.bikeRides || 0) + 1;
      this.events.emit('toast', { icon: '🚲', title: atDock ? 'Bike docked' : 'Bike left outside a dock', text: `${Math.round(mins)} min ride${extra + stray > 0 ? ` · extra ${fmtMoney(extra + stray)}` : ' · no extra charge'}${atDock ? '' : '. Next time, return it to a dock.'}`, kind: atDock ? 'good' : 'warn' });
    }
  }

  nearestDock(p, r = 3) {
    let best = null;
    let bd = r * r;
    for (const d of this.city.bikeDocks || []) {
      const dd = (d.x - p.x) ** 2 + (d.z - p.z) ** 2;
      if (dd < bd) {
        bd = dd;
        best = d;
      }
    }
    return best;
  }

  rentBike() {
    const st = this.state;
    const price = Math.round(SHARE.unlock * (this.sim.city.priceIndex || 1) * 100) / 100;
    if (!this.sim.finance.spend(price, 'transit', 'CityCycle unlock')) return;
    st.flags.bikeShare = { start: st.time.total };
    this.mountBike('share');
    this.events.emit('toast', { icon: '🚲', title: 'CityCycle unlocked', text: `First ${SHARE.includedMin} minutes included, then ${fmtMoney(SHARE.per15 * (this.sim.city.priceIndex || 1))} per 15 min. Return it to any dock.`, kind: 'info' });
  }

  // ---- benches -------------------------------------------------------------------
  nearestBench(p) {
    let best = null;
    let bd = 1.25 * 1.25;
    for (const b of this.city.benchSpots) {
      const d = (b.x - p.x) ** 2 + (b.z - p.z) ** 2;
      if (d < bd) {
        bd = d;
        best = b;
      }
    }
    return best;
  }

  /** Sit down to rest and people-watch (fun and energy slowly recover). */
  sitOn(b) {
    this.player.sitting = true;
    this.player.sitLift = b.lift || 0;
    this.player.sitExit = b.exit || null;
    this.player.teleport(b.x + Math.sin(b.ry) * 0.06, b.z + Math.cos(b.ry) * 0.06, b.ry);
    this.hud.hint('bench', 'Resting on a bench slowly restores Fun and Energy. Move (W A S D) or press E to stand up.', 8);
  }

  /** Sit on a piece of furniture: the seat nearest you, facing out, at its height. */
  sitOnItem(pt, seatH) {
    const it = pt.item;
    const def = pt.def;
    const a = (it.r || 0) * (Math.PI / 2);
    const fx = Math.sin(a);
    const fz = Math.cos(a);
    const rx = Math.cos(a);
    const rz = -Math.sin(a);
    const p = this.player.pos;
    const along = (p.x - it.x) * rx + (p.z - it.z) * rz;
    const half = Math.max(0, def.w / 2 - 0.45);
    const off = Math.max(-half, Math.min(half, along));
    const back = def.d > 0.8 ? 0.08 : 0.02; // sofas: sit back into the cushions
    this.player.sitting = true;
    this.player.sitLift = seatH - 0.48;
    this.player.sitExit = null;
    this.player.teleport(it.x + rx * off - fx * back, it.z + rz * off - fz * back, a);
    this.hud.hint('sitdown', 'Move (W A S D) to get up again.', 5);
  }

  standUp() {
    const p = this.player;
    p.sitting = false;
    p.sitLift = 0;
    p.lying = false;
    const ex = p.sitExit;
    p.sitExit = null;
    if (ex) return p.teleport(ex.x, ex.z, p.heading);
    p.teleport(p.pos.x + Math.sin(p.heading) * 0.75, p.pos.z + Math.cos(p.heading) * 0.75, p.heading);
  }

  /** Now and then, the wail of a siren from an emergency vehicle passing nearby. */
  sirenCheck(dt, inside) {
    this._sirenT = (this._sirenT ?? 4) - dt;
    if (this._sirenT > 0 || inside) return;
    this._sirenT = 4.5;
    const t = this.traffic;
    const p = this.player.pos;
    for (let i = 0; i < t.n; i++) {
      if (!t.alive?.[i] || !t.siren?.[i]) continue;
      if ((t.x[i] - p.x) ** 2 + (t.z[i] - p.z) ** 2 < 70 * 70) {
        this.audio?.play('siren');
        return;
      }
    }
  }

  /** T: wait / skip time. */
  openWait() {
    const opts = [
      [30, '30 minutes'],
      [60, '1 hour'],
      [180, '3 hours'],
      [360, '6 hours'],
    ];
    const el = dialog(this, {
      title: '⏳ Wait',
      body: h(
        'div.menu-col',
        h('div.muted', `It is ${fmtClock(this.state.time.total)}. Time passes while you wait — your needs keep dropping.`),
        opts.map(([m, label]) =>
          btn(label, () => {
            this.closeOverlay(el);
            this.fade(() => this.sim.advance(m));
          }),
        ),
      ),
    });
  }

  // ---------------------------------------------------------- interaction
  /** Nearest thing the player can use right now: { label, action } or null. */
  findInteractable() {
    const p = this.player.pos;
    if (this.player.sitting) return { label: 'Stand up', action: () => this.standUp() };
    if (this.vehicles.driving) return { label: `Get out · ${this.vehicles.mph()} mph`, key: 'F', action: () => this.vehicles.exit() };
    if (this.player.riding) {
      const share = this.player.riding.kind === 'share';
      const dock = share && this.nearestDock(p, 3.2);
      return { label: dock ? 'Dock the CityCycle' : share ? 'Get off (not at a dock: extra fee)' : `Get off · ${Math.round(this.player.riding.v * 2.237)} mph`, action: () => this.dismountBike(!!dock) };
    }
    if (!this.inside) {
      const dock = this.nearestDock(p, 2.4);
      if (dock) return { label: `🚲 Rent a CityCycle · ${fmtMoney(SHARE.unlock * (this.sim.city.priceIndex || 1))}`, action: () => this.rentBike() };
    }
    if (this.pet.near(p) && (!this.inside || this.pet.mesh.parent === this.interior.scene)) {
      // only when you turn to look at your dog (it is usually at your heel)
      const dx = this.pet.pos.x - p.x;
      const dz = this.pet.pos.z - p.z;
      const d = Math.hypot(dx, dz) || 1;
      if ((Math.sin(this.player.heading) * dx + Math.cos(this.player.heading) * dz) / d > 0.55) return { label: `Play with ${this.state.pet.name}`, action: () => openPet(this) };
    }
    if (!this.inside) {
      const happening = this.cityEvents.interactable(p);
      if (happening) return happening;
      const street = this.streetLife.interactable(p);
      if (street) return street;
      const zoo = this.zooLife.interactable(p);
      if (zoo) return zoo;
      const beach = this.beachLife.interactable(p);
      if (beach) return beach;
      const ducks = this.ducks.interactable(p);
      if (ducks) return ducks;
      const live = this.liveEvents.interactable(p);
      if (live) return live;
      const sport = this.sports.interactable(p);
      if (sport) return sport;
      const sk = this.skate.interactable(p);
      if (sk) return sk;
      const show = this.shows.interactable(p);
      if (show) return show;
      const bus = this.bus.interactable(p);
      if (bus) return bus;
      const club = this.clubs.interactable(p);
      if (club) return club;
      const ts = this.city.timesSquare;
      if (ts && (ts.front.x - p.x) ** 2 + (ts.front.z - p.z) ** 2 < 4 * 4) return { label: '🔴 Sit on the red steps and watch the lights', action: () => this.sitOn(ts.seats[18 + Math.floor(Math.random() * 12)]) };
      const br = this.city.bridge;
      if (br && (br.lookout.x - p.x) ** 2 + (br.lookout.z - p.z) ** 2 < 3.5 * 3.5) return { label: '🌉 Lean on the railing and take in the view', action: () => this.enjoyView(br) };
      const bench = this.nearestBench(p);
      if (bench) return { label: 'Sit on the bench', action: () => this.sitOn(bench) };
    }
    if (!this.inside) {
      const car = this.vehicles.nearest(p);
      if (car) return { label: `Drive your ${VEHICLE_BY_ID[car.v.model].name}`, key: 'F', action: () => this.vehicles.enter(car) };
    }
    const actor = this.npcs.nearest(p, !!this.inside);
    if (actor) return { label: `Talk to ${actor.npc.first}`, action: () => openTalk(this, actor.npc, actor) };
    if (this.inside) {
      const pt = this.interior.nearest(p);
      if (!pt) return null;
      if (pt.exit) return { label: this.inside.home ? 'Leave home' : `Leave ${this.inside.place.name}`, action: () => this.leaveInterior() };
      if (pt.lift) return { label: pt.label, action: () => this.switchFloor() };
      const label = pt.item?.id === 'room_phone' ? '📞 Call the front desk' : pt.use === 'service' ? `${this.inside.place.label} counter` : pt.label;
      return { label, action: () => useFurniture(this, pt) };
    }
    let best = null;
    let bd = 3.1 * 3.1;
    for (const pl of this.city.places) {
      const d = (pl.x - p.x) ** 2 + (pl.z - p.z) ** 2;
      if (d < bd) {
        bd = d;
        best = pl;
      }
    }
    if (!best) return null;
    if (best.minor && !shopOpen(best.type, hourOf(this.state.time.total))) return { label: `${best.icon} ${best.name} — closed · opens ${opensAt(best.type)}`, action: null };
    const mine = best.type === 'home' && best.id === 'home_' + this.state.home.districtId;
    if (best.type === 'home' && !mine) return { label: `${best.name} — you do not live here`, action: null };
    const label = best.outdoor ? `🎟️ ${best.name} — tickets` : best.station ? `Take the ${best.label}` : mine ? `Enter your home (${HOME_BY_ID[this.state.home.type].name})` : `Enter ${best.name}`;
    return { label, action: () => this.enterPlace(best) };
  }

  // --------------------------------------------------------------- update
  update(dt, elapsed) {
    const input = this.input;
    if (this.mode === 'creator') {
      this.creator.update(dt);
      this.draw(this.creator.scene, this.creator.camera);
    } else if (this.mode === 'title' || this.mode === 'cityselect') {
      this.updateTitle(dt, elapsed);
    } else if (this.mode === 'play') {
      this.updatePlay(dt, elapsed);
    }
    if (this.settings.get('showFps')) this.fpsEl.textContent = Math.round(this.loop.fps) + ' FPS';
    this._audio ||= {};
    const a = this._audio;
    a.active = this.mode === 'play';
    a.outside = !this.inside;
    a.night = this.sky.night;
    a.weather = this.mode === 'play' ? this.weather.kind : 'clear';
    a.cityCfg = this.city?.cfg;
    a.driving = !!this.vehicles.driving;
    a.musicOn = this.mode !== 'boot';
    this.audio.update(dt, a);
    input.endFrame();
  }

  updateTitle(dt, elapsed) {
    const a = elapsed * 0.035 + 0.6;
    const r = this.city.half + 150;
    const focus = this.camera.position.set(Math.sin(a) * r, 150 + Math.sin(elapsed * 0.05) * 25, Math.cos(a) * r);
    this.camera.lookAt(0, 55, 0);
    worldUniforms.uTime.value = elapsed;
    this.sky.update(this.titleTime, dt, focus);
    this.city.update(elapsed, this.sky.night);
    for (const l of this.lampLights) l.intensity = 0;
    this.traffic.update(dt, elapsed, 18, 0, 0, null, true, 1);
    this.draw(this.scene, this.camera);
  }

  updatePlay(dt, elapsed) {
    const input = this.input;
    const st = this.state;
    const blocked = this.overlays.length > 0 || this.fading;
    st.playtime += dt;

    // --- keys ---
    if (input.pressed('Escape')) {
      // in build mode Esc first drops whatever is being placed
      if (this.build.active && (this.build.held || this.build.mode !== 'idle')) {
        this.build.cancel();
        this.build.mode = 'idle';
        this.build.renderUi();
      } else if (this.overlays.length) this.closeTop();
      else if (this.photoMode.active) this.photoMode.toggle(false);
      else openPause(this);
    } else if (!this.fading) {
      if (input.pressed('Tab') || input.pressed('KeyP')) {
        if (this.phone.isOpen()) this.phone.close();
        else if (!this.overlays.length) this.phone.open();
      }
      if (input.pressed('KeyM') && (this.map.isOpen() || !this.overlays.length)) this.map.toggle();
      if (!blocked) {
        if (input.pressed('KeyH')) this.photoMode.toggle();
        if (input.pressed('KeyX') && !this.build.active) openEmotes(this);
        if (input.pressed('KeyG')) {
          if (this.player.riding) this.dismountBike(this.player.riding.kind === 'share' && !!this.nearestDock(this.player.pos, 3.2));
          else if (this.inside) this.events.emit('toast', { icon: '🚲', title: 'Bike', text: 'Go outside to ride.', kind: 'info' });
          else if (st.bike) this.mountBike(st.bike.model);
          else this.events.emit('toast', { icon: '🚲', title: 'No bike yet', text: 'Rent a CityCycle at a dock, or buy your own at a bike shop (map: Shops).', kind: 'info' });
        }
        if (input.pressed('KeyT') && !this.photoMode.active) this.openWait();
        if (this.player.sitting && ['KeyW', 'KeyA', 'KeyS', 'KeyD'].some((k) => input.pressed(k))) this.standUp();
        if (input.pressed('KeyB')) {
          if (this.inside?.home) this.build.enter();
          else this.events.emit('toast', { icon: '🔨', title: 'Build mode', text: 'Go inside your home first, then press B.', kind: 'info' });
        }
        if (input.pressed('KeyE') && this.interactable?.action && this.interactable.key !== 'F') this.interactable.action();
        if (input.pressed('KeyF') && this.interactable?.key === 'F') this.interactable.action();
        if (import.meta.env.DEV && input.pressed('BracketRight')) this.sim.advance(60, { noCollapse: true });
      }
    }

    // --- build mode owns the screen while it is open ---
    if (this.build.active) {
      this.build.update(dt, input);
      this.interior.update(this.sky.night, this._winColor.copy(this.sky.top).lerp(this.sky.horizon, 0.55), st.time.total);
      this.draw(this.interior.scene, this.build.camera);
      return;
    }

    // --- simulation clock ---
    if (!blocked && !this.photoMode.active) {
      const minPerSec = (1440 / (BALANCE.time.realMinutesPerDay * 60)) * this.settings.get('timeSpeed');
      // sitting on a bench is a gentle rest; otherwise needs just tick
      const em = this.player.emote;
      this.sim.advance(dt * minPerSec, this.player.sitting ? (this.player.lying ? SUNBATHE : SIT_REST) : this.player.swimming ? SWIM : this.player.riding && this.player.riding.v > 1 ? BIKE_RIDE : em && EMOTE_RATES[em.id] ? EMOTE_RATES[em.id] : undefined);
    }

    // --- world ---
    const driving = this.vehicles.update(dt, blocked ? null : input);
    this.player.frozen = blocked || driving;
    if (!driving) this.player.update(dt, blocked || this.photoMode.active ? null : input, this.cam.yaw);
    if (this.player.riding && !blocked && !(input.buttons & 7)) this.cam.yaw = dampAngle(this.cam.yaw, this.player.heading + Math.PI, 2.4, dt);
    this.cam.update(dt, blocked ? null : input, this.player.pos);
    worldUniforms.uTime.value = elapsed;
    const inside = this.inside;
    this.sky.update(hourOf(st.time.total), dt, inside ? this._focus.set(inside.place.x, 0, inside.place.z) : this.player.pos);
    if (inside) this.interior.update(this.sky.night, this._winColor.copy(this.sky.top).lerp(this.sky.horizon, 0.55), st.time.total);
    else {
      this.city.update(elapsed, this.sky.night, this.player.pos.x, this.player.pos.z);
      this.updateLampLights(dt);
    }
    this.weather.update(dt, this.city.cfg, st.time.total, this.camera.position, !inside);
    this.crowd.densityMul = this.weather.info.crowd;
    // rainy days: umbrellas up (yours too, while walking outside)
    const raining = this.weather.kind === 'rain' && !inside;
    this.crowd.raining = raining;
    this.npcs.raining = raining;
    this.player.umbrella = raining && !driving && !this.player.riding && !this.player.sitting;
    setUmbrella(this.playerRig, this.player.umbrella, '#1d2433');
    this.crowd.update(dt, this.player.pos.x, this.player.pos.z, hourOf(st.time.total), !inside, elapsed);
    this.animals.update(dt, this.crowd, this.player.pos.x, this.player.pos.z, this.sky.night, !inside);
    this.streetLife.update(dt, this.player.pos, !!inside);
    this.cityEvents.update(dt, this.player.pos, !!inside);
    this.zooLife.update(dt, this.player.pos, !inside);
    this.campusLife.update(dt, this.player.pos, !inside);
    this.airTraffic.update(dt, this.player.pos, !inside);
    this.bridgeLife.update(dt, this.player.pos, !inside);
    this.timesSquare.update(dt, this.player.pos, !inside);
    this.beachLife.update(dt, this.player.pos, !inside);
    this.ducks.update(dt, this.player.pos, !inside);
    this.liveEvents.update(dt, this.player.pos, !!inside);
    this.sirenCheck(dt, inside);
    // stairs inside bigger places
    const SL = inside && !inside.home ? inside.layout?.stairs : null;
    if (SL && !this.fading) {
      const lv = inside.level || 0;
      if (lv === 0 && this.player.pos.y > 1.3) this.useStairs(1);
      else if (lv === 1 && this.player.pos.y < -1.3) this.useStairs(0);
    }
    this.sports.update(dt, this.player.pos, !inside);
    this.skate.update(dt, this.player.pos, !inside);
    this.shows.update(dt, this.player.pos, !!inside);
    this.fireworks.update(dt, this.player.pos, !!inside);
    this.bus.update(dt);
    this.playground.update(dt, this.player.pos, !!inside);
    this.clubs.update(dt, this.player.pos, !!inside);
    this.playerBalloon?.userData.tick?.(performance.now() / 1000);
    if (inside) this.subway.update(dt);
    this.npcs.update(dt, this.player.pos, !!inside);
    if (this.pet.active && (!inside || this.pet.mesh.parent === this.interior.scene)) {
      const w = inside ? this.interior.world : this.city;
      this.pet.update(dt, { player: this.player, colliders: w.colliders, groundY: w.groundY, hidden: !!driving });
      // walking the dog: game minutes spent moving outside together
      if (!inside && !driving && !blocked && this.player.speed > 0.8) this.sim.pets.walk(dt * (1440 / (BALANCE.time.realMinutesPerDay * 60)) * this.settings.get('timeSpeed'));
    }
    if (inside?.place.type === 'shelter') this.shelterDogs.update(dt);
    updateEmote(this, dt);
    // a phone in your hand for calls and selfies
    const wantPhone = ['phone', 'selfie'].includes(this.player.emote?.id) && this.playerRig.bones?.handR;
    if (wantPhone && !this.phoneMesh) {
      this.phoneMesh = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.075, 0.009), new THREE.MeshStandardMaterial({ color: '#16171b', roughness: 0.3, metalness: 0.4 }));
      this.phoneMesh.position.set(0, -0.07, 0.035);
      this.playerRig.bones.handR.add(this.phoneMesh);
    } else if (!wantPhone && this.phoneMesh) {
      this.phoneMesh.removeFromParent();
      this.phoneMesh = null;
    }
    if (this.bikeMesh) for (const w of this.bikeMesh.userData.wheels) w.rotation.x += ((this.player.riding?.v || 0) * dt) / 0.34;
    this.traffic.parked = this.vehicles.parkedOBBs();
    this.traffic.update(dt, elapsed, hourOf(st.time.total), this.player.pos.x, this.player.pos.z, this.crowd, !inside, this.weather.info.crowd);

    this.tutorial.update();

    // --- interaction prompt + HUD ---
    this._interactT = (this._interactT || 0) - dt;
    if (this._interactT <= 0) {
      this._interactT = 0.12;
      this.interactable = blocked ? null : this.findInteractable();
      this.hud.setPrompt(this.interactable ? this.interactable.label : null, this.interactable?.action ? this.interactable.key || 'E' : '✕');
      if (this.interactable) this.hud.hint('interact', 'Press E to use doors, shops, people and furniture.');
    }
    this._objT = (this._objT || 0) - dt;
    if (this._objT <= 0) {
      this._objT = 0.5;
      if (this.photoMode.active) this.photoMode.refresh();
      const o = computeObjective(this);
      this.hud.setObjective(o[0], o[1]);
      this.checkSeason();
      // a life event is waiting: show it at a calm moment during the day
      const hr = hourOf(st.time.total);
      if (st.events.pending && !blocked && !this.overlays.length && hr >= 8 && hr < 22) openLifeEvent(this);
    }
    this.hud.update(dt);

    this.autoQuality(dt);
    this.draw(inside ? this.interior.scene : this.scene, this.camera);
  }

  updateLampLights(dt) {
    this._lampTimer -= dt;
    const night = this.sky.night;
    const on = night > 0.05 && this.quality !== 'low';
    if (this._lampTimer <= 0) {
      this._lampTimer = 0.35;
      const lp = this.city.lampPositions;
      const px = this.player.pos.x;
      const pz = this.player.pos.z;
      const best = [1e9, 1e9, 1e9];
      const idx = [-1, -1, -1];
      for (let i = 0; i < lp.length; i += 2) {
        const d = (lp[i] - px) ** 2 + (lp[i + 1] - pz) ** 2;
        for (let k = 0; k < 3; k++) {
          if (d < best[k]) {
            for (let m = 2; m > k; m--) {
              best[m] = best[m - 1];
              idx[m] = idx[m - 1];
            }
            best[k] = d;
            idx[k] = i;
            break;
          }
        }
      }
      for (let k = 0; k < 3; k++) if (idx[k] >= 0) this.lampLights[k].position.set(lp[idx[k]], 5.6, lp[idx[k] + 1]);
    }
    for (const l of this.lampLights) l.intensity = on ? night * 36 : 0;
  }

  /** Drop one graphics preset if the frame rate stays low for several seconds. */
  autoQuality(dt) {
    if (!this.settings.get('autoQuality') || this.loop.elapsed < 8) return;
    if (this.loop.fps < 34) this.lowFpsTime += dt;
    else this.lowFpsTime = Math.max(0, this.lowFpsTime - dt * 2);
    if (this.lowFpsTime > 6) {
      this.lowFpsTime = 0;
      const q = this.quality;
      if (q === 'high') this.settings.set('graphics', 'medium');
      else if (q === 'medium') this.settings.set('graphics', 'low');
      if (q !== 'low') this.events.emit('toast', { icon: '⚙️', title: 'Graphics lowered', text: 'Switched to a faster preset to keep things smooth.', kind: 'info' });
    }
  }
}
