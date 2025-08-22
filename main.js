import * as THREE from 'three';
import WebGL from 'three/addons/capabilities/WebGL.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

// General constants
const FRAMES_PER_SECOND = 60;
const WORLD_DEPTH = 200;
const CHUNK_SIZE = 16;
const MINING_DISTANCE = 3;

// Game state constants
const STATE_WELCOME = 0;
const STATE_ERROR = 1;
const STATE_GAME = 2;

var game = {
    state: STATE_WELCOME,
    scene: null,
    camera: null,
    renderer: null,
    controls: null,
    blocks: {},
    physics: {
        gravity: 0.1,
        margin: 0.2,
    },
    player: {
        miningBlock: null,
        miningTime: 0,
        inventory: {},
        jumpHeight: 3,
        isJumping: false,
        jumpAccumulator: 0,
    },
    raycaster: new THREE.Raycaster(),
    pointer: new THREE.Vector2(0, 0),
    inputState: {
        forward: false,
        backward: false,
        left: false,
        right: false,
        jump: false,
        mining: false,
    },
    clock: new THREE.Clock(),
    delta: 0,
    block: {
        types: {
            bedrock: {
                name: 'bedrock',
                color: 0x000000,
                time: -1,
            },
            dirt: {
                name: 'dirt',
                color: 0x8b4513,
                time: 20,
            },
            stone: {
                name: 'stone',
                color: 0x808080,
                time: 25,
            },
            copper: {
                name: 'copper',
                color: 0xb87333,
                time: 30,
            },
            silver: {
                name: 'silver',
                color: 0xc0c0c0,
                time: 35,
            },
            gold: {
                name: 'gold',
                color: 0xffd700,
                time: 65,
            },
            emerald: {
                name: 'emerald',
                color: 0x50c878,
                time: 80,
            },
            ruby: {
                name: 'ruby',
                color: 0xe0115f,
                time: 95,
            },
            amethyst: {
                name: 'amethyst',
                color: 0x9966cc,
                time: 110,
            },
            unobtainium: {
                name: 'unobtainium',
                color: 0x0000ff,
                time: 165,
            },
        },
        layers: {
            dirt: {
                name: 'dirt',
                depth: -1,
                types: [
                    {
                        name: 'dirt',
                        rarity: 1,
                    },
                    {
                        name: 'stone',
                        rarity: 0.15,
                    },
                    {
                        name: 'copper',
                        rarity: 0.05,
                    },
                    {
                        name: 'silver',
                        rarity: 0.025,
                    },
                    {
                        name: 'gold',
                        rarity: 0.015,
                    },
                    {
                        name: 'emerald',
                        rarity: 0.001,
                    },
                    {
                        name: 'ruby',
                        rarity: 0.0075,
                    }
                ],
            },
            stone: {
                name: 'stone',
                depth: 25,
                types: [
                    {
                        name: 'stone',
                        rarity: 1,
                    },
                    {
                        name: 'copper',
                        rarity: 0.075,
                    },
                    {
                        name: 'silver',
                        rarity: 0.05,
                    },
                    {
                        name: 'gold',
                        rarity: 0.025,
                    },
                    {
                        name: 'emerald',
                        rarity: 0.075,
                    },
                    {
                        name: 'ruby',
                        rarity: 0.1,
                    },
                    {
                        name: 'bedrock',
                        rarity: 0.01,
                    },
                    {
                        name: 'amethyst',
                        rarity: 0.0005,
                    },
                    {
                        name: 'unobtainium',
                        rarity: 0.00001,
                    }
                ],
            },
            gold: {
                name: 'gold',
                depth: 175,
                types: [
                    {
                        name: 'gold',
                        rarity: 1,
                    },
                    {
                        name: 'copper',
                        rarity: 0.075,
                    },
                    {
                        name: 'silver',
                        rarity: 0.05,
                    },
                    {
                        name: 'emerald',
                        rarity: 0.075,
                    },
                    {
                        name: 'ruby',
                        rarity: 0.1,
                    },
                    {
                        name: 'amethyst',
                        rarity: 0.00075,
                    },
                    {
                        name: 'unobtainium',
                        rarity: 0.00001,
                    },
                    {
                        name: 'bedrock',
                        rarity: 0.01,
                    }
                ],
            },
            bedrock: {
                name: 'bedrock',
                depth: 200,
                types: [
                    {
                        name: 'bedrock',
                        rarity: 1,
                    }
                ],
            },
        },
        geometry: new THREE.BoxGeometry(1, 1, 1),
    }
};

game.physics.intersects = function (position) {
    const sphere = new THREE.Sphere(position, game.physics.margin);
    const chunkKey = game.block.chunkKey(position);

    if (!(chunkKey in game.blocks)) {
        return false;
    }

    const boxes = Object.values(game.blocks[chunkKey])
        .filter(block => block !== null)
        .map(block => block.box);

    for (let i = 0; i < boxes.length; i++) {
        if (boxes[i].intersectsSphere(sphere)) {
            return true;
        }
    }

    return false;
};

game.block.key = function (position) {
    return position.x + ',' + position.y + ',' + position.z;
};

game.block.chunkKey = function (position) {
    const chunk = new THREE.Vector3(
        Math.floor(Math.round(position.x) / CHUNK_SIZE),
        Math.floor(Math.round(position.y) / CHUNK_SIZE),
        Math.floor(Math.round(position.z) / CHUNK_SIZE),
    );

    return game.block.key(chunk);
};

game.block.create = function (position, type = null) {
    // If there's no type specified, randomly select one
    if (type === null) {
        // Sort layers based on their depth
        const layers = Object.values(game.block.layers)
            .sort((a, b) => b.depth - a.depth);

        let layer = null;

        // Determine the current layer based on the position
        for (let i = 0; i < layers.length; i++) {
            if (position.y < -layers[i].depth) {
                layer = layers[i];
                break;
            }
        }

        if (layer === null) {
            console.error('No layer found for position', position);
            return;
        }

        // Sort the types based on the selected layer's rarity
        const types = Object.values(layer.types)
            .sort((a, b) => a.rarity - b.rarity);

        for (let i = 0; i < types.length; i++) {
            if (Math.random() < types[i].rarity) {
                type = game.block.types[types[i].name];
                break;
            }
        }
    }

    const material = new THREE.MeshPhongMaterial({ color: type.color });
    const mesh = new THREE.Mesh(game.block.geometry, material);

    mesh.position.x = position.x;
    mesh.position.y = position.y;
    mesh.position.z = position.z;

    const box = new THREE.Box3().setFromObject(mesh);

    const key = game.block.key(position);
    const chunkKey = game.block.chunkKey(position);

    // Create new chunk if it doesn't exist
    if (!(chunkKey in game.blocks)) {
        game.blocks[chunkKey] = {};
    }

    // Check if cube already exists
    if (key in game.blocks[chunkKey]) {
        return;
    }

    game.blocks[chunkKey][key] = {
        object: mesh,
        box: box,
        type: type,
    };

    game.scene.add(mesh);
};

game.block.destroy = function (block) {
    if (block !== null) {
        const key = game.block.key(block.object.position);
        const chunkKey = game.block.chunkKey(block.object.position);

        // Remove the cube from the scene and grid
        game.scene.remove(block.object);
        game.blocks[chunkKey][key] = null;

        // Add block to inventory if not already there
        // Otherwise simply add to the count
        if (!(block.type.name in game.player.inventory)) {

            const inventoryParent = document.getElementById('inventory');

            // Create new element
            const inventoryElement = document.createElement('div');
            inventoryElement.className = 'inventory-item';
            inventoryElement.style.backgroundColor = '#' + block.type.color.toString(16);
            inventoryElement.style.color = 'white';
            inventoryElement.innerHTML = block.type.name + ' x1';
            inventoryParent.appendChild(inventoryElement);

            game.player.inventory[block.type.name] = {
                element: inventoryElement,
                amount: 0,
            };
        }

        game.player.inventory[block.type.name].amount += 1;
        game.player.inventory[block.type.name].element.innerHTML = block.type.name + ' x' + game.player.inventory[block.type.name].amount;

        const directions = [
            'UP', 'DOWN', 'LEFT', 'RIGHT', 'FRONT', 'BACK'
        ];

        for (let i = 0; i < directions.length; i++) {
            // Ensure we can't create a block above the world origin
            if (directions[i] == 'UP' && block.object.position.y >= -1) {
                continue;
            }

            let type = null;

            if (directions[i] == 'LEFT' && block.object.position.x <= -8) {
                type = game.block.types.bedrock;
            }

            if (directions[i] == 'RIGHT' && block.object.position.x >= 7) {
                type = game.block.types.bedrock;
            }

            if (directions[i] == 'FRONT' && block.object.position.z <= -8) {
                type = game.block.types.bedrock;
            }

            if (directions[i] == 'BACK' && block.object.position.z >= 7) {
                type = game.block.types.bedrock;
            }

            let position = new THREE.Vector3(
                block.object.position.x,
                block.object.position.y,
                block.object.position.z
            );

            switch (directions[i]) {
                case 'UP':
                    position.y += 1;
                    break;
                case 'DOWN':
                    position.y -= 1;
                    break;
                case 'LEFT':
                    position.x -= 1;
                    break;
                case 'RIGHT':
                    position.x += 1;
                    break;
                case 'FRONT':
                    position.z -= 1;
                    break;
                case 'BACK':
                    position.z += 1;
                    break;
            }

            // Check if there's no block here already
            const key = game.block.key(position);
            if (key in game.blocks) continue;

            game.block.create(position, type);
        }
    }
};

game.init = function () {
    // Ensure the browser supports WebGL
    if (!WebGL.isWebGLAvailable()) {
        console.error(WebGL.getWebGLErrorMessage());
        game.setState(STATE_ERROR);
        return;
    }

    // Create the scene
    game.scene = new THREE.Scene();

    // Set up lighting
    game.scene.add(new THREE.AmbientLight(0xffffff));
    game.scene.add(new THREE.HemisphereLight(0xffffbb, 0x080820, 1));
    game.scene.add(new THREE.DirectionalLight(0xffffff, 0.5));

    // Set up the camera
    game.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    game.camera.position.y = 1.5;

    // Set up the controls
    var supportsPointerLock = 'pointerLockElement' in document
        || 'mozPointerLockElement' in document
        || 'webkitPointerLockElement' in document;

    game.controls = new PointerLockControls(game.camera, document.body);
    game.scene.add(game.controls.getObject());

    if (!supportsPointerLock) {
        game.setState(STATE_ERROR);
        return;
    }

    game.setupPointerLock();

    game.setupKeyboard();
    game.setupMouse();

    // Set up the renderer
    game.renderer = new THREE.WebGLRenderer();
    game.renderer.setSize(window.innerWidth, window.innerHeight);
    game.renderer.setAnimationLoop(game.animate);
    document.body.appendChild(game.renderer.domElement);

    game.setupResize();

    // Set up initial grid
    for (let x = -8; x < 8; x++) {
        for (let z = -8; z < 8; z++) {
            // Ensure the top layer is always made of dirt
            game.block.create(new THREE.Vector3(x, 0, z), game.block.types.dirt);
        }
    }
}

game.setState = function (state) {
    // Don't change the state if it's already set
    if (game.state === state)
        return;

    switch (state) {
        case STATE_WELCOME:
            document.getElementById('welcome').style.display = 'block';
            document.getElementById('browser-not-supported').style.display = 'none';
            document.getElementById('hud').style.display = 'none';
            break;
        case STATE_ERROR:
            document.getElementById('browser-not-supported').style.display = 'block';
            document.getElementById('welcome').style.display = 'none';
            document.getElementById('hud').style.display = 'none';
            break;
        case STATE_GAME:
            document.getElementById('welcome').style.display = 'none';
            document.getElementById('browser-not-supported').style.display = 'none';
            document.getElementById('hud').style.display = 'block';
            break;
    }

    game.state = state;
}

game.castRay = function () {
    // Update the raycaster and perform the raycasting
    game.raycaster.setFromCamera(game.pointer, game.camera);

    const chunks = Object.keys(game.blocks);
    if (chunks.length === 0) return null;

    for (let i = 0; i < chunks.length; i++) {
        const chunkKey = chunks[i];

        const objects = Object.values(game.blocks[chunkKey])
            .filter(block => block !== null)
            .map(block => block.object);

        const intersects = game.raycaster.intersectObjects(objects);

        if (intersects.length > 0) {
            // Check if the block is within mining distance
            if (intersects[0].distance > MINING_DISTANCE) return null;

            const key = game.block.key(intersects[0].object.position);
            const block = game.blocks[chunkKey][key];

            return block;
        }
    }

    return null;
}

game.setupResize = function () {
    function onWindowResize() {
        game.camera.aspect = window.innerWidth / window.innerHeight;
        game.camera.updateProjectionMatrix();

        game.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    window.addEventListener('resize', onWindowResize, false);
}

game.setupPointerLock = function () {

    const pointerLockChange = function () {
        if (document.pointerLockElement === document.body
            || document.mozPointerLockElement === document.body
            || document.webkitPointerLockElement === document.body) {
            game.controls.enabled = true;
            game.setState(STATE_GAME);
        } else {
            game.controls.enabled = false;
            game.setState(STATE_WELCOME);
        }
    };

    const pointerLockError = function (event) {
        console.error('Pointer lock error', event);
    }

    document.addEventListener('pointerlockchange', pointerLockChange, false);
    document.addEventListener('mozpointerlockchange', pointerLockChange, false);
    document.addEventListener('webkitpointerlockchange', pointerLockChange, false);

    document.addEventListener('pointerlockerror', pointerLockError, false);
    document.addEventListener('mozpointerlockerror', pointerLockError, false);
    document.addEventListener('webkitpointerlockerror', pointerLockError, false);

    document.body.addEventListener('click', function () {
        document.body.requestPointerLock = document.body.requestPointerLock
            || document.body.mozRequestPointerLock
            || document.body.webkitRequestPointerLock;
        document.body.requestPointerLock();
    }, false);
}

game.setupKeyboard = function () {
    const onKeyDown = function (event) {
        switch (event.keyCode) {
            case 38: // up
            case 87: // w
                game.inputState.forward = true;
                break;
            case 37: // left
            case 65: // a
                game.inputState.left = true;
                break;
            case 40: // down
            case 83: // s
                game.inputState.backward = true;
                break;
            case 39: // right
            case 68: // d
                game.inputState.right = true;
                break;
            case 32: // space
                game.inputState.jump = true;
                break;
        }
    }

    const onKeyUp = function (event) {
        switch (event.keyCode) {
            case 38: // up
            case 87: // w
                game.inputState.forward = false;
                break;
            case 37: // left
            case 65: // a
                game.inputState.left = false;
                break;
            case 40: // down
            case 83: // s
                game.inputState.backward = false;
                break;
            case 39: // right
            case 68: // d
                game.inputState.right = false;
                break;
            case 32: // space
                game.inputState.jump = false;
                break;
        }
    }

    document.addEventListener('keydown', onKeyDown, false);
    document.addEventListener('keyup', onKeyUp, false);
}

game.setupMouse = function () {

    const onMouseDown = function () {
        if (game.controls.enabled) {
            game.inputState.mining = true;
        }
    }

    const onMouseUp = function () {
        if (game.controls.enabled) {
            game.inputState.mining = false;

            // Stop mining the block
            game.player.miningBlock = null;
            game.player.miningTime = 0;
        }
    }

    document.addEventListener('mousedown', onMouseDown, false);
    document.addEventListener('mouseup', onMouseUp, false);
}

game.animate = function () {
    if (!game.controls.enabled) return;
    game.delta += game.clock.getDelta();

    if (game.delta > (1 / FRAMES_PER_SECOND)) {
        // Handle the current input state
        if (game.inputState.forward) {
            game.controls.moveForward(0.1);

            if (game.physics.intersects(game.controls.getObject().position)) {
                game.controls.moveForward(-0.1);
            }
        }
        if (game.inputState.backward) {
            game.controls.moveForward(-0.1);

            if (game.physics.intersects(game.controls.getObject().position)) {
                game.controls.moveForward(0.1);
            }
        }
        if (game.inputState.left) {
            game.controls.moveRight(-0.1);

            if (game.physics.intersects(game.controls.getObject().position)) {
                game.controls.moveRight(0.1);
            }
        }
        if (game.inputState.right) {
            game.controls.moveRight(0.1);

            if (game.physics.intersects(game.controls.getObject().position)) {
                game.controls.moveRight(-0.1);
            }
        }
        if (game.inputState.jump) {
            if (!game.player.isJumping) {
                game.player.isJumping = true;
                game.player.jumpAccumulator = 0;
            }
            game.inputState.jump = false;
        }

        if (game.player.isJumping) {
            // TODO: Improve jumping physics
            let jumpForce = (game.player.jumpHeight - game.player.jumpAccumulator) / game.player.jumpHeight;

            game.controls.getObject().position.y += 0.2 * jumpForce;
            game.player.jumpAccumulator += 0.2;

            if (game.physics.intersects(game.controls.getObject().position)) {
                game.controls.getObject().position.y -= 0.2 * jumpForce;
                game.player.isJumping = false;
            }

            if (game.player.jumpAccumulator >= game.player.jumpHeight) {
                game.player.isJumping = false;
            }
        } else {
            game.controls.getObject().position.y -= game.physics.gravity;

            // We don't want to clip the player onto the face of the cube, so give a little bit of space
            let playerFeet = new THREE.Vector3(
                game.controls.getObject().position.x,
                game.controls.getObject().position.y - 0.5,
                game.controls.getObject().position.z,
            );

            if (game.physics.intersects(playerFeet)) {
                game.controls.getObject().position.y += game.physics.gravity;
            }
        }

        if (game.inputState.mining) {
            const currentBlock = game.castRay();

            if (game.player.miningBlock === null) {
                if (currentBlock !== null) {
                    game.player.miningBlock = currentBlock;
                    game.player.miningTime = 0;
                }
            } else {
                if (currentBlock !== game.player.miningBlock) {
                    game.player.miningBlock = currentBlock;
                    game.player.miningTime = 0;
                } else {
                    if (game.player.miningBlock.type.time > 0) {
                        game.player.miningTime += 1;

                        if (game.player.miningTime > game.player.miningBlock.type.time) {
                            game.block.destroy(game.player.miningBlock);

                            // Try to find the next block to mine
                            const nextBlock = game.castRay();
                            if (nextBlock !== null) {
                                game.player.miningBlock = nextBlock;
                                game.player.miningTime = 0;
                            }
                        }
                    }
                }
            }
        }

        // Round current player position to nearest whole number
        const blockPosition = new THREE.Vector3(
            Math.round(game.controls.getObject().position.x),
            Math.round(game.controls.getObject().position.y),
            Math.round(game.controls.getObject().position.z),
        );
        document.getElementById('coords').textContent = 'X: ' + blockPosition.x + ', Y: ' + blockPosition.y + ', Z: ' + blockPosition.z;

        // Determine darkness based on player depth
        const darkness = Math.min(0.95, Math.max(0, -blockPosition.y / WORLD_DEPTH));
        document.getElementById('overlay').style.opacity = darkness;

        for (let i = 0; i < Object.keys(game.blocks).length; i++) {
            const chunkKey = Object.keys(game.blocks)[i];
            
            // Reset the material color for each cube
            for (let j = 0; j < Object.keys(game.blocks[chunkKey]).length; j++) {
                const key = Object.keys(game.blocks[chunkKey])[j];
                if (game.blocks[chunkKey][key] === null) continue;

                game.blocks[chunkKey][key].object.material.color.set(
                    game.blocks[chunkKey][key].type.color
                );
            }
        }

        const block = game.castRay();

        if (block !== null && block.type.time > 0) {
            let factor = 0.05;

            if (game.player.miningBlock === block) {
                factor = (game.player.miningTime / block.type.time) * 0.15;
            }

            // Take the color of the block and make it lighter
            let color = new THREE.Color(block.type.color);
            color = color.lerp(new THREE.Color(0xffffff), factor);

            block.object.material.color.set(color);
        }

        requestAnimationFrame(game.animate);
        game.delta %= (1 / FRAMES_PER_SECOND);
    }

    game.renderer.render(game.scene, game.camera);
}

game.init();
