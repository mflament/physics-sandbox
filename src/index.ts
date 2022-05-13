interface Config {
    maxSpeed: number;
    acceleration: number;
    deceleration: number;
    minDistance: number;
}

interface State {
    acceleration: number;
    position: number;
    velocity: number;
}

class PositionUpdater {
    readonly state: State;
    private _target = 0;
    targetVelocity = 0;

    constructor(readonly config: Config) {
        this.state = {position: 0, velocity: 0, acceleration: 0};
    }

    get target(): number {
        return this._target;
    }

    set target(t: number) {
        this._target = clamp(t, -1, 1);
    }

    update(dt: number): void {
        const {state, config} = this;
        const {velocity, position} = state;
        const a = this.computeAcceleration(dt);
        const v = clamp(velocity + a * dt, -config.maxSpeed, config.maxSpeed);
        const p = clamp(position + v * dt, -1, 1);
        state.acceleration = a;
        state.velocity = v;
        state.position = p;
    }

    private computeAcceleration(dt: number): number {
        const {state, config, _target} = this;
        const {position, velocity} = state;

        let dist = Math.abs(_target - position);
        if (dist <= config.minDistance) {
            this.targetVelocity = 0;
            return -velocity / dt;
        }

        const targetDir = Math.sign(_target - position);
        const currentSpeed = Math.abs(velocity);
        const currentDir = Math.sign(velocity);

        // https://en.wikipedia.org/wiki/Braking_distance
        // braking distance (bd) = -vi² / 2a  (a = -deceleration)
        // vi = sqrt(-(bd * 2a)), but can not exceed max speed
        const targetSpeed = Math.min(config.maxSpeed, Math.sqrt(dist * 2 * config.deceleration));
        this.targetVelocity = targetDir * targetSpeed;

        let maxAcceleration, aDir;
        if (targetDir * currentDir < 0 || targetSpeed < currentSpeed) { // change of direction or brake
            maxAcceleration = config.deceleration;
            aDir = -currentDir;
        } else {
            maxAcceleration = config.acceleration;
            aDir = targetDir;
        }

        const a = Math.min(maxAcceleration, Math.abs(targetSpeed - currentSpeed) / dt);
        return a * aDir;
    }

}

function clamp(n: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, n));
}


function setupContainer(container: HTMLElement, config: Config): void {
    container.innerHTML = `
            <div id="plots">
                <div id="axis"></div>
                <div id="position" class="plot"></div>
                <div id="target" class="plot" draggable="true"></div>
                <div id="current_speed" class="vector"></div>
                <div id="target_speed" class="vector"></div>
                <div id="acceleration" class="vector"></div>
            </div>
            <div id="state">
              <label>Acceleration</label><div id="state_acceleration"></div>
              <label>Speed</label><div id="state_speed"></div>
            </div>
        `;
    setTimeout(() => setupElements(config));
}

const noDragImg = new Image();
noDragImg.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs=';

function setupElements(config: Config): void {
    const {plots, target, position, speedDiv, accelDiv, targetSpeedVector, currentSpeedVector, accelerationVector} = {
        plots: find('plots'),
        position: find('position'),
        target: find('target'),
        currentSpeedVector: find('current_speed'),
        targetSpeedVector: find('target_speed'),
        accelerationVector: find('acceleration'),
        speedDiv: find('state_speed'),
        accelDiv: find('state_acceleration')
    };

    let plotWidth: number, plotsRect: DOMRect, maxPos: number;
    let dragClickOffset = 0;
    let maxSpeed = 0;
    const updater = new PositionUpdater(config);
    const state = updater.state;
    let lastUpdate = performance.now();

    function resized(): void {
        plotWidth = position.getBoundingClientRect().width;
        plotsRect = plots.getBoundingClientRect();
        maxPos = plotsRect.width - plotWidth;
    }

    window.onresize = resized;
    resized();

    function toScreen(world: number): number {
        return maxPos * (world / 2 + 0.5);
    }

    function toWorld(screen: number): number {
        return (screen / maxPos) * 2 - 1;
    }

    function setupTarget(target: HTMLElement): void {
        target.ondragstart = e => {
            if (e.dataTransfer) {
                e.dataTransfer.setDragImage(noDragImg, 0, 0);
                const plotRect = target.getBoundingClientRect();
                dragClickOffset = e.clientX - plotRect.left;
                maxSpeed = 0;
            }
        }
        target.ondrag = e => {
            e.preventDefault();
            if (e.screenX === 0 && e.screenY === 0) return;
            const screenPos = e.clientX - plotsRect.left - dragClickOffset;
            updater.target = toWorld(screenPos);
        }
        target.ondrop = e => e.preventDefault();
    }

    function update(time: number) {
        target.style.left = toScreen(updater.target) + 'px';
        position.style.left = toScreen(state.position) + 'px';

        const dt = (time - lastUpdate) / 1000;
        updater.update(dt);

        maxSpeed = Math.max(Math.abs(state.velocity), maxSpeed);
        updateSpeedVector(targetSpeedVector, state.position, updater.targetVelocity);
        updateSpeedVector(currentSpeedVector, state.position, state.velocity);
        updateSpeedVector(accelerationVector, state.position, state.acceleration);

        updateStateDivs();
        lastUpdate = time;
        requestAnimationFrame(update);
    }

    function updateSpeedVector(element: HTMLElement, position: number, velocity: number): void {
        let className = 'vector';
        const plotCenter = toScreen(position) + plotWidth / 2;
        const screenLength = (Math.abs(velocity) / 2) * maxPos - 4; // 4px for arrow offset
        const style = element.style;
        style.width = screenLength + 'px'
        if (velocity < 0) {
            style.left = plotCenter - screenLength + 'px';
            className += ' arrow-left';
        } else if (velocity > 0) {
            style.left = plotCenter + 'px';
            className += ' arrow-right';
        } else {
            className += ' hidden';
        }
        element.className = className;
    }

    function updateStateDivs() {
        accelDiv.textContent = state.acceleration.toFixed() + ' (' + (state.acceleration / config.acceleration).toFixed(1) + ')';
        speedDiv.textContent = state.velocity.toFixed() + ' (' + (state.velocity / config.maxSpeed).toFixed(1) + ') max: ' + (maxSpeed / config.maxSpeed).toFixed(2);
    }

    setupTarget(target);
    updateStateDivs();
    requestAnimationFrame(update);
}


function find<T extends HTMLElement>(id: string): T {
    const element = document.getElementById(id);
    if (!element) throw new Error("Element " + id + " not found");
    return element as T;
}

const container = find('psb');

setupContainer(container, {
    maxSpeed: 4,
    acceleration: 2,
    deceleration: 2,
    minDistance: 0.001
});
