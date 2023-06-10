/*:
 * @plugindesc (v1.0) Minigame based on stepmania
 * @author contentdeleted
 *
 * @param Enable Note Sound
 * @type boolean
 * @on YES
 * @off NO
 * @desc Play a sound when the player hits a note
 * NO - false     YES - true
 * @default true
 * 
 * @param Note Sound
 * @parent ---Defaults---
 * @type String
 * @desc What sound to play when the note is hit
 * @default hit
 * 
 * @help  
 * =============================================================================
 * 
 * Implements a DDR "inspired" rhythm minigame with support for .SM charts.
 * Songs should be in the /charts/ in a SONGNAME folder.
 * For more information on the .SM format: https://github-wiki-see.page/m/stepmania/stepmania/wiki/sm
 * 
 * A few note types are not currently supported, but charts with unsupported note types should still render
 * 
 * =============================================================================
 * Before launching the plugin make sure to add the following images to your img folder
 *  
 *   /img/rpgmania/arrow.png     -  Player controlled arrows
 *   /img/rpgmania/note.png      -  Note arrows
 *   /img/rpgmania/hold.png      -  Looping hold bar texture
 *   /img/rpgmania/rank.png      -  Sprite text for combo and hit results
 *   /img/rpgmania/skybox0.png   -  Skybox side
 *   /img/rpgmania/skybox1.png   -  Skybox side
 *   /img/rpgmania/skybox2.png   -  Skybox bottom
 *   /img/rpgmania/skybox3.png   -  Skybox top
 *   /img/rpgmania/skybox4.png   -  Skybox side
 *   /img/rpgmania/skybox5.png   -  Skybox side
 *   /img/rpgmania/stage.png     -  Stage top texture
 *   /img/rpgmania/stageside.png -  Stage sides texture
 *   /img/rpgmania/char.png      -  (Optional) Picture of character to do a silly dance :)
 * 
 *  IMPORTANT: Additionally, make sure to install the pixi-projection library by copying it into your js/libs folder 
 *  and updating your index.html file. See the example project for an example.
 * ============================================================================= 
 * Start minigame examples:
 * 
 *    Run a single song plugin command:
 *      rpgmania playsong SONGNAME DIFFICULTY (Use battler face instead of char picture)
 *      rpgmania playsong AA Hard true
 * 
 *    Open the song list (will load all songs from the /charts folder of the project)
 *      rpgmania songlist
 * 
 * =============================================================================
 * License:
 * 
 * Copyright (c) 2023 Jacob Hann
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 * 
 */

var Imported = Imported || {};
Imported.GH_RPGmania = true;

var GH_RPGmania = GH_RPGmania || {};

GH_RPGmania.Parameters = PluginManager.parameters('GH_RPGmania');
GH_RPGmania.enableNoteSFX = GH_RPGmania.Parameters["Enable Note Sound"];
GH_RPGmania.noteSFX = GH_RPGmania.Parameters["Note Sound"];

// For loading images that are used in 3d perspective objects
ImageManager.loadRPGmaniaTexture = function(filename) {
    var path = 'img/rpgmania/' + encodeURIComponent(filename) + '.png';
    return PIXI.Texture.from(path);
};

// All other sprite images are loaded like this
ImageManager.loadRPGmaniaBitmap = function (filename) {
    return this.loadBitmap('img/rpgmania/', filename, 0, true);
};

GH_RPGmania.CHARTSFOLDER = 'charts/';

GH_RPGmania.getChartNames = function (chartCallback) {
    if(!this.fs) this.fs = require('fs');
    // requires checking the root dir
    this.fs.readdir("www/" + GH_RPGmania.CHARTSFOLDER, (err, files) => {
        if(err) {
            return;
        }

        // build?
        GH_RPGmania.CHARTSFOLDER = 'www/charts/';

        chartCallback(files);
    });

    // still check this for not build I guess
    this.fs.readdir(GH_RPGmania.CHARTSFOLDER, (err, files) => {
        if(err) {
            console.log(err);
            return;
        }

        chartCallback(files);
    });
    // Dont do it like this
    // let request = new XMLHttpRequest();

    // request.open('get', GH_RPGmania.CHARTSFOLDER, true);
    // request.send();

    // request.onreadystatechange = function() {
    //     if (request.readyState === 4) {
    //         let names = [...request.responseText.matchAll(/\.\/.*(\d|\w).*\/\"/gm)];
    //         let chartNames = names.map(s => String(s).split("/")[1]);
    //         GH_RPGmania.chartsNames = chartNames;
            
    //         chartCallback(chartNames);
    //     }
    // }
}

GH_RPGmania.loadChart = function (chartName) {
    let xhr = new XMLHttpRequest();
    let folder = GH_RPGmania.CHARTSFOLDER + chartName + "/";
    let smFile = folder + chartName + ".sm";
    xhr.open('GET', smFile);
    xhr.overrideMimeType('text/plain');
    xhr.onload = function() {
        if (xhr.status < 400) {
            GH_RPGmania.charts = GH_RPGmania.charts || {};
            GH_RPGmania.charts[chartName] = GH_RPGmania.parseChart(chartName, xhr.responseText);
        }
    };
    xhr.onerror = function() {
        DataManager._errorUrl = DataManager._errorUrl || smFile;
    };
    xhr.send();
}

GH_RPGmania.parseChart = function(chartName, chartRaw) {
    let lines = chartRaw.split('#');
    let obj = { CHARTNAME: chartName, OFFSET: 0, NOTES: {} };
    lines.forEach(line => {
        let end = line.indexOf(";");
        let start = line.indexOf(":")
        if (end <= 0) return;

        let key = line.substring(0, start);
        let content = line.substring(start+1, end);
        if(key != "NOTES") {
            obj[key] = content;
        } else {
            let notes = GH_RPGmania.parseNotes(content);
            // FOR NOW IGNORE DOUBLE CHARTS
            if(notes.chartType == "dance-single") {
                obj.NOTES[notes.difficulty] = notes;
            }
        }
    })

    return obj;
}


GH_RPGmania.parseNotes = function(rawContent) {
    let data = rawContent.split(":");
    if(data.length < 6) {
        console.log("error parsing chart");
        return;
    }
    let cleanUp = (d) => String(d).trim().replaceAll("\\n","").replaceAll("\\r","");
    // This is always in the same order
    obj = {
        "chartType": cleanUp(data[0]),
        "description": cleanUp(data[1]),
        "difficulty": cleanUp(data[2]),
        "meter": cleanUp(data[3]),
        "groveRadar": cleanUp(data[4]),
    }
    // split into measures
    let measures  = String(data[5]).split(",");
    // Note data is defined in terms of "measures" where a measure is several lines of text,
    // terminated by a comma. The final measure in a chart is terminated by a semicolon instead.
    // Each line consists of a set of characters representing each playable column in the chart type.

    // Split measures out into an array of notes either 4th, 8th, 12th, 16th, 24th, 32nd, 48th, 64th, and 192nd
    // We can check this by the length of this subarray
    // Also clean out comments since some newer charts contain them
    obj.data = measures.map(s => s.trim().split(/\r?\n/).filter(x => !x.startsWith("//")));
    return obj;
}

//=============================================================================
// ** Game_Interpreter
//=============================================================================	

GH_RPGmania._Game_Interpreter_prototype_pluginCommand = Game_Interpreter.prototype.pluginCommand
Game_Interpreter.prototype.pluginCommand = function(command, args) {
	GH_RPGmania._Game_Interpreter_prototype_pluginCommand.call(this,command, args)
	if (command === "rpgmania")  {
        switch (args[0]){
            case "playsong": {
                $gameSystem._rpgmania_data = {
                    songList: false,
                    songName: args[1],
                    difficulty: args[2],
                    useActorImage: args[3],
                };
                $gameSystem._rpgmania_start = true;
                this.wait(10);
                break;
            }
            case "songlist": {
                $gameSystem._rpgmania_data = {
                    songList: true,
                };
                $gameSystem._rpgmania_start = true;
                this.wait(10);
                break;
            }
            default: {
                console.error(`Incorrect plugin command format: "${command} ${args[0]}" expect "rpgmania playsong" or "rpgmania songlist"`);
            }
        }
    };	
	return true;
};

//=============================================================================
// ** Scene Map
// * This is where we hook in the scene flag
//=============================================================================	

GH_RPGmania.an_Scene_Map_prototype_update = Scene_Map.prototype.update
Scene_Map.prototype.update = function() {
	GH_RPGmania.an_Scene_Map_prototype_update.call(this);
	if ($gameSystem._rpgmania_start) {
        this.execute_rpgmania();
    }
};

Scene_Map.prototype.execute_rpgmania = function() {
    $gameSystem._rpgmania_start = false;
    this.startFadeOut(this.fadeSpeed());
    $gameSystem.rpgmania();
};

//=============================================================================
// ** Game_System
//=============================================================================	

GH_RPGmania._Game_System_prototype_initialize = Game_System.prototype.initialize
Game_System.prototype.initialize = function() {
    GH_RPGmania._Game_System_prototype_initialize.call(this);
	this._rpgmania_start = false; // flag to activate
};

Game_System.prototype.rpgmania = function() {
    SceneManager.push(Scene_RPGmania);
};

//=============================================================================
// ** Scene_RPGmania
// * This is the actual scene definition, its pretty straight forward
// * We have several phases, in this case intro, gameplay, and result
// * When results are finished the scene is pop'd off the scene manager stack 
// * and we go back to wherever it was called
//=============================================================================

function Scene_RPGmania() {
    this.initialize.apply(this, arguments);
}

Scene_RPGmania.prototype = Object.create(Scene_Base.prototype);
Scene_RPGmania.prototype.constructor = Scene_RPGmania;

Scene_RPGmania.prototype.create = function() {
    Scene_Base.prototype.create.call(this);	

    $gameSystem._rpgmania_start = false; // already started
    this._rpgmania_phase = 0; // start phase
    this.pluginData = $gameSystem._rpgmania_data;
    $gameSystem._rpgmania_data = null; // clear data for next command
    this._phase_state = 0; // incremented at each point in a phase ie fade in -> wait for input -> fade out
    this._score = 0;
    this._combo = 0;
    this._highest_combo = 0;
    this.rankings = new Array(6);
    this.rankings.fill(0);
    this._playerY = Graphics.boxHeight - 50;
    this._battlers = $gameParty.battleMembers();
    this.useActorImage = this.pluginData && !!this.pluginData.useActorImage;

    BattleManager.saveBgmAndBgs();
	AudioManager.fadeOutBgm(2);
	AudioManager.stopBgs();

    if(!this.pluginData || this.pluginData.songList) {
        this.createWindowLayer();
        this.createSongListWindow();
        this.startFadeIn(20, false);
    } else {
        this.createDisplayObjects();
        this.songName = this.pluginData.songName;
        this.difficulty = this.pluginData.difficulty;
        this._phase_state++;
        this.startFadeIn(100, false);
    }
}

Scene_RPGmania.prototype.isBusy = function() {
    return this._fadeDuration > 90;
}

Scene_RPGmania.prototype.updateFade = function() {
    if (this._fadeDuration > 0) {
        var d = this._fadeDuration;
        if(d < 30) {
            if (this._fadeSign > 0) {
                this._fadeSprite.opacity -= this._fadeSprite.opacity / d;
            } else {
                this._fadeSprite.opacity += (255 - this._fadeSprite.opacity) / d;
            }
        }
        this._fadeDuration--;
    }
};

Scene_RPGmania.prototype.createSongListWindow = function(){
    var wx = 0; 
    var wy = 0;
    var ww = Graphics.boxWidth - 0;
    var wh = Graphics.boxHeight - 0;
    this._songListWindow = new Window_SongList(wx, wy, ww, wh);
    this.addWindow(this._songListWindow);
    this.addWindow(this._songListWindow.diffWindow);
}

Scene_RPGmania.prototype.currentTime = function() {
    // This could go somewhere else and only be calculated once (not sure if needed what does this do??)
    let offset = Number(this.chart.OFFSET);

    return this._songBuffer._sourceNode.context.currentTime - this._songBuffer._startTime;
}

Scene_RPGmania.prototype.totalTime = function() {
    return this._songBuffer._buffer.duration;
}

Scene_RPGmania.prototype.load_images = function() {
    this._note_img = ImageManager.loadRPGmaniaBitmap("note");
    this._arrow_img = ImageManager.loadRPGmaniaBitmap("arrow");
    this._hold_img = ImageManager.loadRPGmaniaBitmap("hold");
    this._rank_img = ImageManager.loadRPGmaniaBitmap("rank");

    this._skybox_imgs = [];
    for(let i = 0; i < 6; i++) {
        this._skybox_imgs[i] = ImageManager.loadRPGmaniaTexture("skybox"+i);
    }

    this._stage_top_img = ImageManager.loadRPGmaniaTexture("stage");
    this._stage_side_img = ImageManager.loadRPGmaniaTexture("stageside");

    if(this.useActorImage && this._battlers && this._battlers.length) {
        var path = 'img/faces/' + encodeURIComponent(this._battlers[0].faceName()) + '.png';
        this._char_img = PIXI.Texture.from(path);
    } else {
        this._char_img = ImageManager.loadRPGmaniaTexture("char");
    }
}

Scene_RPGmania.prototype.createDisplayObjects = function() {
    this.load_images();

    this.createBackground();

    // base for the hud
	this._spriteHudBase = new Sprite();
	this.addChild(this._spriteHudBase);

    // Setup all sprites, the order matters for layers
    this.createComboDigits();
    this.createPlayerSprite();
    this.createObjectPoolManager();
    this.createScoreText();
}

Scene_RPGmania.prototype.createBackground = function() {
    let scale = 1;
    this._camContainer = new Sprite(new Bitmap(Graphics.boxWidth / scale, Graphics.boxHeight / scale));
    this._camContainer.scale.x = scale;
    this._camContainer.scale.y = scale;
    this._camContainer.x = Graphics.boxWidth / 2;
    this._camContainer.y = Graphics.boxHeight / 2;
    this._camContainer.anchor.x = 0.5;
    this._camContainer.anchor.y = 0.5;
    this.addChild(this._camContainer);
    
    this._camera = new PIXI.projection.Camera3d(); 
    this._camera.setPlanes(400, 0, 10000, false);
    this._camera.position.set(0, 0);
    this._camera.scale.x = 1 / scale;
    this._camera.scale.y = 1 / scale;
    this._camContainer.addChild(this._camera);

    this._skybox = [];
    for(let i = 0; i < 6; i++) {
        let sky = new PIXI.projection.Sprite3d();
        this._camera.addChild(sky);
        sky.anchor.set(0, 0);
        sky.texture = this._skybox_imgs[i];
        
        sky.isFrontFace = () => true;
        sky._renderWebGL = function (renderer) {
            this.calculateVertices();
            renderer.setObjectRenderer(renderer.plugins[sky.pluginName]);
            renderer.plugins[sky.pluginName].render(sky);
        };
        sky._back = true;
        this._skybox.push(sky);
    }
}

Scene_RPGmania.prototype.buildSkybox = function() {
    let width = this._skybox_imgs[0].width;
    let dist = width;
    let scale = 1.5;

    // scale to texture size
    for(let i = 0; i < this._skybox.length; i++) {
        this._skybox[i].scale.x = scale;
        this._skybox[i].scale.y = scale;
        this._skybox[i].scale.z = scale;
    }

    let halfdist = dist / 2.0;

    this._camera.position3d.y = 0;
    this._camera.position3d.x = halfdist;
    this._camera.position3d.z = halfdist;
    this._camera.origin = JsonEx.makeDeepCopy(this._camera.position3d);

    this._skybox[0].position3d.z = halfdist*2;
    this._skybox[0].position3d.y = -halfdist;
    this._skybox[1].position3d.z = 0;
    this._skybox[1].position3d.y = -halfdist;
    
    this._skybox[2].position3d.y = halfdist;
    this._skybox[2].euler.x = Math.PI / 2.0;
    this._skybox[3].position3d.y = -halfdist;
    this._skybox[3].euler.x = Math.PI / 2.0;

    this._skybox[4].position3d.x = 2*halfdist;
    this._skybox[4].position3d.y = -halfdist;
    this._skybox[4].position3d.z = 2*halfdist;
    this._skybox[4].euler.y = Math.PI / 2.0;
    this._skybox[5].position3d.x = 0;
    this._skybox[5].position3d.y = -halfdist;
    this._skybox[5].position3d.z = 2*halfdist;
    this._skybox[5].euler.y = Math.PI / 2.0;

    this.createDancer();
    this.createStage();

    this._camera.addChild(this._stage_top);
    for(let i = 0; i < 4; i++) {
        this._camera.addChild(this._stage_sides[i]);
    }
    this._camera.addChild(this._dancer);
}

Scene_RPGmania.prototype.createStage = function() {
    this._stage_top = new PIXI.projection.Sprite3d(this._stage_top_img);
    this._stage_top.anchor.set(0.5, 0.5);
    this._stage_top.position3d.x = this._dancer.position3d.x;
    this._stage_top.position3d.y = this._dancer.position3d.y;
    this._stage_top.position3d.z = this._dancer.position3d.z;
    
    this._stage_top.euler.x = Math.PI / 2.0;
    this._stage_top._renderWebGL = function (renderer) {
        this.calculateVertices();
        renderer.setObjectRenderer(renderer.plugins[this.pluginName]);
        renderer.plugins[this.pluginName].render(this);
    };
    this._stage_top._front = true;

    let dist = this._stage_top_img.width;

    this._stage_sides = [];
    for(let i = 0; i < 4; i++) {
        this._stage_sides[i] = new PIXI.projection.Sprite3d(this._stage_side_img);
        this._stage_sides[i].anchor.set(0.5, 0);
        this._stage_sides[i].position3d.x = this._dancer.position3d.x;
        this._stage_sides[i].position3d.y = this._dancer.position3d.y;
        this._stage_sides[i].position3d.z = this._dancer.position3d.z;
        this._stage_sides[i]._renderWebGL = function (renderer) {
            this.calculateVertices();
            renderer.setObjectRenderer(renderer.plugins[this.pluginName]);
            renderer.plugins[this.pluginName].render(this);
        };
    }
    this._stage_sides[0].position3d.z += dist / 2.0;
    this._stage_sides[1].position3d.z += -dist / 2.0;

    this._stage_sides[2].euler.y = Math.PI / 2.0;
    this._stage_sides[2].position3d.x += dist / 2.0;
    this._stage_sides[3].euler.y = Math.PI / 2.0;
    this._stage_sides[3].position3d.x += -dist / 2.0;

}

Scene_RPGmania.prototype.createDancer = function() {
    this._dancer = new PIXI.projection.Sprite3d(this._char_img);
    this._dancer.anchor.set(0.5, 1);
    this._dancer.position3d.x = this._camera.position3d.x;
    this._dancer.position3d.z = this._camera.position3d.z + 100;
    this._dancer.position3d.y = this._camera.position3d.y + 100;

    this._dancer.origin = JsonEx.makeDeepCopy(this._dancer.position3d);

    this._dancer._front = true;


    if(this.useActorImage && this._battlers && this._battlers.length) {
        let actor = this._battlers[0];
        let pw = Window_Base._faceWidth;
        let ph = Window_Base._faceHeight;	
        let sx = actor.faceIndex() % 4 * pw;
        let sy = Math.floor(actor.faceIndex() / 4) * ph;	 
        this._dancer.setFrame(sx,sy,pw,ph);
    }
}

Scene_RPGmania.prototype.updateDancer = function() {
    if(this._dancer.scale.y > 1) {
        this._dancer.scale.y -= 0.02;
        this._dancer.position3d.y = this._dancer.origin._y - (this._dancer.scale.y - 1) * this._dancer.texture.height;
    } else {
        this._dancer.scale.y = 1;
    }
}

let distance3d = (a, b) => {
    return -Math.sqrt(Math.pow(b.position3d._x - a.position3d._x, 2)  + Math.pow(b.position3d._z - a.position3d._z, 2));
}

Scene_RPGmania.prototype.updateCamera = function() {
    //this._camera.euler.z -= 0.003;
    //this._camera.euler.x -= 0.003;
    this._camera.euler.y -= 0.003;
    this._camera.position3d.x += 0.5;
    if(this._camera.position3d.x > this._camera.origin._x + 200) this._camera.position3d.x = this._camera.origin._x - 200;

    this._camera.children.sort((a,b) => a._front ? 0 : a._back ? 999999 : distance3d(a, this._camera) - distance3d(b, this._camera));

    // console.log(`top: ${distance3d(this._stage_top, this._camera)}`);
    // for(let i = 0; i < 4; i++) {
    //     console.log(`side ${i}: ${distance3d(this._stage_sides[i], this._camera)}`);
    // }
}


Scene_RPGmania.prototype.createObjectPoolManager = function() {
    this._objectPoolManager = new Sprite_RPGmaniaNotePoolManager(this._note_img, this._hold_img);
    this._objectPoolManager.x = Graphics.boxWidth / 2
    this._spriteHudBase.addChild(this._objectPoolManager);
}

Scene_RPGmania.prototype.createScoreText = function() {	
    this._scoretext_sprite = new Sprite(new Bitmap(250,48));
    this._scoretext_sprite.anchor.x = 0.5;
    this._scoretext_sprite.anchor.y = 0.5; 
    this._scoretext_sprite.x = Graphics.boxWidth / 2 + 48;
    this._scoretext_sprite.y = 50;
    this._scoretext_sprite.bitmap.fontSize = 36;
    this._spriteHudBase.addChild(this._scoretext_sprite);
};

Scene_RPGmania.prototype.createComboDigits = function() {	
    // max 9999
    this._comboDigits = [];
    for(let i = 0; i < 4; i++) {
        this._comboDigits[i] = new Sprite(this._rank_img);
        this._comboDigits[i].anchor.x = 0.5;
        this._comboDigits[i].anchor.y = 0.5;
        this._spriteHudBase.addChild(this._comboDigits[i]);
    }

    this._comboText = new Sprite(this._rank_img);
    this._comboText.anchor.y = 0.5;
    this._comboText.visible = false;
    this._spriteHudBase.addChild(this._comboText);

    this._rankText = new Sprite(this._rank_img);
    this._rankText.anchor.y = 0.5;
    this._rankText.anchor.x = 0.5;
    this._rankText.visible = false;
    this._spriteHudBase.addChild(this._rankText);
};

Scene_RPGmania.prototype.setupComboDigits = function() {
    let x = Graphics.boxWidth * 0.66;
    let y = Graphics.boxHeight / 3;
    for(let i = 0; i < 4; i++) {
        let digit = this._comboDigits[i];
        digit.x = x - this.comboDigitWidth() * i - 120;
        digit.y = y;
    }

    this._comboText.x = x - 70;
    this._comboText.y = y;
    let w = this.comboTextWidth();
    let h = this.comboDigitHeight();
    this._comboText.setFrame(w * 1, h * 3, w, h);

    this._rankText.x = x + 20;
    this._rankText.y = Graphics.boxHeight / 2;
    this._rankText.timer = 0;
}

Scene_RPGmania.prototype.comboDigitWidth = function() {
    return this._rank_img ? Math.round(this._rank_img.width / 10) : 0;
};

// Used for both
Scene_RPGmania.prototype.comboDigitHeight = function() {
    return this._rank_img ? Math.round(this._rank_img.height / 4) : 0;
};

Scene_RPGmania.prototype.comboTextWidth = function() {
    return this._rank_img ? Math.round(this._rank_img.width / 2) : 0;
};

Scene_RPGmania.prototype.drawComboDigits = function(value) {
    let string = Math.abs(value).toString();
    let w = this.comboDigitWidth();
    let h = this.comboDigitHeight();
    let len = this._comboDigits.length;
    for (var i = 0; i < len; i++) {
        let digit = this._comboDigits[i];
        if(value > 0 && i < string.length) {
            let n = Number(string[string.length - (i+1)]);
            digit.setFrame(n * w, 0, w, h);
            digit.visible = true;
        } else {
            digit.visible = false;
        }
        // digit.x = (i - (string.length - 1) / 2) * w;
        // digit.dy = -i;
    }
    this._comboText.visible = value > 0;
};

Scene_RPGmania.prototype.updateRankText = function() {
    if(this._rankText.timer >= 0) {
        this._rankText.visible = true;
        let scale = Math.max(1, 1 + (this._rankText.timer - 30) / 100);
        this._rankText.scale.x = scale;
        this._rankText.scale.y = scale; 
    } else {
        this._rankText.visible = false;
    }
    this._rankText.timer--;
}

Scene_RPGmania.prototype.createPlayerSprite = function() {	
    this._player_sprite = new Sprite_RPGmaniaPlayer(this._arrow_img);
    this._player_sprite.opacity = 255;
    this._player_sprite.anchor.x = 0.5;
    this._player_sprite.anchor.y = 0.5; 
    this._player_sprite.x = Graphics.boxWidth / 2;
    this._player_sprite.y = this._playerY;

    this._spriteHudBase.addChild(this._player_sprite);
};

Scene_RPGmania.prototype.update = function() {
    Scene_Base.prototype.update.call(this);
    
	this.update_phase();
};

Scene_RPGmania.prototype.update_phase = function() {
    switch (this._rpgmania_phase) {
		case 0:
            this.update_start_phase();
            break;
		case 1:
            this.update_play_phase();
            break;
		case 2:
            this.update_end_phase();
            break;	
    };
};

Scene_RPGmania.prototype.update_start_phase = function() {
    switch (this._phase_state) {
		case 0:
            // Wait on list menuing
            break;
		case 1:
            GH_RPGmania.loadChart(this.songName);
            this.waitTimer = 0;
            this._phase_state++;
            break;
        case 2:
            // wait for load
            this.waitTimer++;
            if(this.waitTimer > 60 && GH_RPGmania.charts && GH_RPGmania.charts[this.songName]) {
                this.chart = GH_RPGmania.charts[this.songName];
                this.noteData = this.chart.NOTES[this.difficulty].data;
                this._phase_state++;

                this.buildSkybox();
                this.setupComboDigits();
                this.setupDanceInfo();
            }
            break;
        case 3:
            this._rpgmania_phase = 1;
            this._phase_state = 0;		

            this.startMusic();
            break;
	};
};

Scene_RPGmania.prototype.startMusic = function() {
    let url = `${GH_RPGmania.CHARTSFOLDER}${this.chart.CHARTNAME}/${this.chart.MUSIC}`;
    this._songBuffer = new WebAudio(url);
    this._songBuffer.volume = 0.1;
    this._songBuffer.play(true, 0);
}

Scene_RPGmania.prototype.update_play_phase = function() {
    // Update score
    this._scoretext_sprite.bitmap.clear();
    this._scoretext_sprite.bitmap.drawText(this._score,0,0,100,48,"right");

    // Update combo
    this.drawComboDigits(this._combo);

    // Update rank text
    this.updateRankText();

    // Update Camera
    this.updateCamera();

    this.updateDancer();
}

Scene_RPGmania.prototype.setupDanceInfo = function() {
    let measures = this.noteData;
    this._danceBeats = [];
    
    for(let i = 0; i < measures.length; i++) {
        let beats = measures[i];
        for(let j = 0; j < beats.length; j++) {
            let time = (i + (j) / beats.length) / (measures.length);
            this._danceBeats.push(time);
        }
    }
}

Scene_RPGmania.prototype.bltComboDigits = function(target, x, y, value) {
    let string = Math.abs(value).toString();
    let w = this.comboDigitWidth();
    let h = this.comboDigitHeight();
    for (var i = 0; i < string.length; i++) {
        let n = Number(string[i]);
        target.blt(this._rank_img, n*w, 0, w - 3, h, x + i * w, y);
    }
};

Scene_RPGmania.prototype.bltComboText = function(target, x, y, rank) {
    let w = this.comboTextWidth();
    let h = this.comboDigitHeight();
    let row = Math.floor(rank / 2);
    target.blt(this._rank_img, w * (rank % 2), h * (row + 1), w, h, x, y);
}

Scene_RPGmania.prototype.update_end_phase = function() {
    switch (this._phase_state) {
        case 0:
            this._phase_state = 1;
            AudioManager.fadeOutBgm(1);
            this._songBuffer.stop();

            // hide combo
            this.drawComboDigits(0);

            // create scoring
            this._final_sprite = new Sprite(new Bitmap(Graphics.boxWidth,Graphics.boxHeight));
            this._final_sprite.x = 200;
            this._final_sprite.y = 80; 
            this._final_sprite.bitmap.fontSize = 36;
            this._spriteHudBase.addChild(this._final_sprite);

            let y = 0;
            let x = this.comboTextWidth() + 10;
            for(let i = 0; i < 5; i++) {
                this.bltComboText(this._final_sprite.bitmap, 0, y, i);
                this.bltComboDigits(this._final_sprite.bitmap, x, y, this.rankings[i]);
                y += this.comboDigitHeight();
            }

            this.bltComboText(this._final_sprite.bitmap, 0, y, 5);
            this.bltComboDigits(this._final_sprite.bitmap, x, y, this._highest_combo);

            break;
        case 1:
            // wait for input
            if (Input.isTriggered("ok") || Input.isTriggered("cancel") || TouchInput.isTriggered()) {
                SoundManager.playCursor();
                this._phase_state = 2;
            }
            break;
        case 2:
            // probably set a game variable with the score
            this.fadeOutAll();
            SceneManager.pop();
            this._rpgmania_phase = 4;
            break;
    };	
};

Scene_RPGmania.prototype.terminate = function() {
	Scene_Base.prototype.terminate.call(this);
	BattleManager.replayBgmAndBgs();
	$gameSystem._rpgmania = false;
};

// ===========================================
// * Sprite_RPGmaniaPlayer 
// Controls the player input and arrows
// ===========================================
function Sprite_RPGmaniaPlayer() {
    this.initialize.apply(this, arguments);
}

Sprite_RPGmaniaPlayer.prototype = Object.create(Sprite_Base.prototype);
Sprite_RPGmaniaPlayer.prototype.constructor = Sprite_RPGmaniaPlayer;

Sprite_RPGmaniaPlayer.prototype.initialize = function(arrow_img) {
    Sprite_Base.prototype.initialize.call(this);

    // left down up right
    this.arrowSprites = [];
    for(let i = 0; i < 4; i++) {
        let arrow = new Sprite(arrow_img);
        arrow.x = i * 100;
        arrow.y = 0;
        arrow.opacity = 255;
        arrow.anchor.x = 0.5;
        arrow.anchor.y = 0.5;
        arrow.rotation = Scene_RPGmania.getArrowRotation(i);
        this.arrowSprites.push(arrow);
        this.addChild(arrow);
    }
};

// 0    1    2  3
// left down up right
Scene_RPGmania.getArrowRotation = function(num) {
    switch (num) {
        case 0: return 90 * Math.PI / 180
        case 1: return Math.PI / 180
        case 2: return Math.PI
        case 3: return 270 * Math.PI / 180
    } 
}

Sprite_RPGmaniaPlayer.prototype.update = function() {
    Sprite_Base.prototype.update.call(this);

    // only update during gameplay phase
	if(SceneManager._scene._rpgmania_phase !== 1) return;

    this.updateInput();
    this.updateArrowVisuals();
};

Sprite_RPGmaniaPlayer.prototype.updateArrowVisuals = function() {
    this.arrowSprites.forEach(a => {
        if(a.scale.x < 1) {
            a.scale.x += 0.02;
            a.scale.y += 0.02;
        }
    });
}

Sprite_RPGmaniaPlayer.prototype.updateInput = function() {
    Sprite_Base.prototype.update.call(this);

    // let noteBitmap = 0b0000;
    // if (Input.isPressed("left")) {
    //     this.arrowPressed(0);
    //     noteBitmap |= 0b0001;
    // }
    // if (Input.isPressed("down")) {
    //     this.arrowPressed(1);
    //     noteBitmap |= 0b0010;
    // }
    // if (Input.isPressed("up")) {
    //     this.arrowPressed(2);
    //     noteBitmap |= 0b0100;
    // }
    // if(Input.isPressed("right")) {
    //     this.arrowPressed(3);
    //     noteBitmap |= 0b1000;
    // }
    // if(noteBitmap != 0) {
    //     this.prevNoteBitmap
    //     SceneManager._scene.validateNote(noteBitmap);
    // }

    // this.prevNoteBitmap = noteBitmap;

    let a = ["left","down","up","right"];
    let pressedBitmap = 0b0000;
    for(let i = 0; i < 4; i++) {
        let pressed = Input.isPressed(a[i]);
        pressedBitmap |= (pressed ? 1 : 0) << i;
        if(pressed) this.arrowPressed(i);
    }

    if(pressedBitmap != 0) {
        let noteBitmap = pressedBitmap & ~this._prevNoteBitmap;
        SceneManager._scene.validateNote(noteBitmap);
    }
    
    SceneManager._scene.updateHeldNotes(pressedBitmap);

    this._prevNoteBitmap = pressedBitmap;
};

Sprite_RPGmaniaPlayer.prototype.arrowPressed = function(num) {
    let arrow = this.arrowSprites[num];

    // handle visual for pressing
    let scale = 0.7;
    arrow.scale.x = scale;
    arrow.scale.y = scale;
}


// ===========================================
// * Sprite_RPGmaniaNotePoolManager
// * Controls the notes
// ===========================================
function Sprite_RPGmaniaNotePoolManager() {
    this.initialize.apply(this, arguments);
}

Sprite_RPGmaniaNotePoolManager.prototype = Object.create(Sprite_Base.prototype);
Sprite_RPGmaniaNotePoolManager.prototype.constructor = Sprite_RPGmaniaNotePoolManager;

Sprite_RPGmaniaNotePoolManager.prototype.initialize = function(note_img, hold_img) {
    Sprite_Base.prototype.initialize.call(this);
    this._note_img = note_img;
    this._hold_img = hold_img;

    this._pool = [];
    this._active = [];
    this._held = [];
    this._lastHold = [];
    this._waitingforend = [];
    this.allocate(20);
    this.currentMeasure = 0;

    this.SPEED = 60000;
};

Sprite_RPGmaniaNotePoolManager.prototype.allocate = function(count) {
    for(let i = 0; i < count; i++) {
        let note = new Sprite(this._note_img);
        note.opacity = 255;
        note.anchor.x = 0.5;
        note.anchor.y = 0.5;
        note.setDir = function(dir) {
            this.rotation = Scene_RPGmania.getArrowRotation(dir);
            this.x = dir * 100;
        }
        note.clean = function() {
            note.played = false;
            note.missed = false;
            if(note.held) {
                note.held.parentNote = null;
            }
            note.held = undefined;
        }
        note.play = function() {
            if(GH_RPGmania.enableNoteSFX) {
                AudioManager.playSe({name: GH_RPGmania.noteSFX, volume: 80, pitch: 100, pan: 50});
            }
            note.played = true;
        }
        this._pool.push(note);
    }
}

Sprite_RPGmaniaNotePoolManager.prototype.spawn = function(dir, time) {
    if(this._pool.length == 0) {
        this.allocate(10);
    }
    let note = this._pool.pop();
    note.setDir(dir);
    note.dir = dir;
    note.time = time;
    this.addChild(note);
    this._active.push(note);
    return note;
}

// A hold note draws on the tail of a regular note
Sprite_RPGmaniaNotePoolManager.prototype.setupHold = function(holdNote, note){
    holdNote.bitmap = this._hold_img;
    holdNote.anchor.x = 0.5;
    holdNote.anchor.y = 1;
    holdNote.x = note.dir * 100;
    holdNote.parentNote = note;
    holdNote.dir = note.dir;
    holdNote.time = note.time;
    note.held = holdNote;
    this._held.push(holdNote);
    return holdNote;
}

Sprite_RPGmaniaNotePoolManager.prototype.releaseHeld = function(hold) {
    this._held.splice(this._held.indexOf(hold), 1);
    this.removeChild(hold);
}

Sprite_RPGmaniaNotePoolManager.prototype.update = function() {
    Sprite_Base.prototype.update.call(this);

    // only update during gameplay phase
	if(SceneManager._scene._rpgmania_phase !== 1) return;

    let s = SceneManager._scene;
    let measures = s.noteData;
    // sometimes doesnt load quick enough
    if(!s._songBuffer._buffer) return;

    // This could go somewhere else and only be calculated once (not sure if needed what does this do??)
    let offset = Number(s.chart.OFFSET);

    let curTime = s.currentTime();
    let total = s.totalTime();

    if(curTime >= total) {
        SceneManager._scene._rpgmania_phase = 2;
    }

    // percentage of the way through the song
    let curP = curTime / total;

    let measureCount = measures.length;
    let curMes = curP * measureCount;


    while(Math.ceil(curMes + 5) > this.currentMeasure && this.currentMeasure < measureCount) {
        beats = measures[this.currentMeasure];
        for(let i = 0; i < beats.length; i++) {
            let beat = beats[i];
    
            // I dont really understand why the quarter measure offset is needed but it seems like it is
            let time = (this.currentMeasure + (i) / (1.0 * beats.length)) / (1.0 * measures.length);
            if(beat.length == 4) {
                // position of the note on screen (ie left down up right)
                for(let pos = 0; pos < 4; pos++) {
                    let note = beat[pos];
                    switch(note) {
                        case '1': {
                            this.spawn(pos, time);
                            break;
                        }
                        // hold notes head
                        case '2': {
                            // spawn the hold note first actually so that its under
                            let holdNote = new TilingSprite();
                            this.addChild(holdNote);
                            let note = this.spawn(pos, time);
                            this._lastHold[pos] = this.setupHold(holdNote, note);
                            break;
                        }
                        // hold notes tail
                        case '3': {
                            this._lastHold[pos].tail = time;
                            break;
                        }
                        case '0':
                        default:
                            // do nothing for 0
                            break;
                    }
                }
            }
        }
        this.currentMeasure++;
    }

    // Update notes
    this._active.forEach(note => {
        let timeDist = note.time - curP;
        note.y = SceneManager._scene._playerY - this.SPEED * (timeDist);
        
        // // play sound when moves past the middle (this is for autoplay)
        // if(!note.played && timeDist <= 0) {
        //     note.play();
        // }

        if(!note.played && !note.missed && timeDist * total <= -Scene_RPGmania.NOTETIMINGS.MISS) {
            note.missed = true;
            SceneManager._scene.setRankText(0);
            SceneManager._scene.rankings[0]++;
            SceneManager._scene._combo = 0;
        }
    });

    // Update holds
    let cullHeld = [];
    this._held.forEach(hold => {

        let y = 0;
        let height = 0;
        if(hold.heldDown) {
            y = s._playerY;
            height = this.SPEED * (hold.tail - curP);
        } else {
            let timeDist = hold.time - curP
            y = s._playerY - this.SPEED * (timeDist);
            height = hold.tail ? this.SPEED * (hold.tail - hold.time): y;
        }
        hold.move(hold.x, y, this._hold_img.width, height);
        if(y - height >= Graphics.boxHeight || height <= 0) {
            cullHeld.push(hold);
        }
    });
    cullHeld.forEach(x => this.releaseHeld(x));

    // lowest note is always at the bottom
    while(this._active.length && this._active[0].y > Graphics.boxHeight + 100) {
        // Return to pool
        let note = this._active.shift();
        if(!note.missed) {
            SceneManager._scene.setRankText(0);
            SceneManager._scene.rankings[0]++;
            SceneManager._scene._combo = 0;
        }
        note.clean();
        this.removeChild(note);
        this._pool.push(note);
    }

    // update dancer
    if(s._danceBeats.length && curP > s._danceBeats[0]) {
        s._danceBeats.shift();
        s._dancer.scale.y = 1.3;
    }
};


Scene_RPGmania.NOTETIMINGS = {
    MISS: 0.1,
    BAD: 0.1,
    GOOD: 0.06,
    GREAT: 0.04,
    PERFECT: 0.01,
}

Scene_RPGmania.prototype.validateNote = function(noteBitmap) {
    let currentTime = this.currentTime();
    let totalTime = this.totalTime();

    let cur = 0;
    while(this._objectPoolManager._active && cur < this._objectPoolManager._active.length) {
        let note = this._objectPoolManager._active[cur];
        if(note.time && !note.missed) {
            // time until the note arrives (or negative time since it arrived)
            let t = note.time * totalTime - currentTime;

            // notes before this are too far away dont bother
            if(t >= Scene_RPGmania.NOTETIMINGS.MISS) {
                break;
            } 

            let timing = Math.abs(t);
            let behind = (t < 0); // ahead or behind
            if(timing < Scene_RPGmania.NOTETIMINGS.MISS && 1 << note.dir & noteBitmap) {
                    // remove bit from map to avoid double press
                    noteBitmap &= ~(1 << note.dir);
                    if(note.held) {
                        note.held.heldDown = true;
                    }
                    // Remove note
                    note.clean();
                    this._objectPoolManager._active.splice(cur, 1);
                    this._objectPoolManager.removeChild(note);
                    this._objectPoolManager._pool.push(note);

                    // Play hit
                    note.play();

                    // Handle points
                    if(timing > Scene_RPGmania.NOTETIMINGS.BAD) {
                        // Miss -> lose point
                        this._score -= 10;
                        this._combo = 0;
                        this.setRankText(0);
                        SceneManager._scene.rankings[0]++;
                    } else if(timing > Scene_RPGmania.NOTETIMINGS.GOOD) {
                        // BAD -> ~Hit but no combo??~ nevermind its annoying
                        this._score += 100;
                        this._combo++;
                        this.setRankText(1);
                        SceneManager._scene.rankings[1]++;
                    } else if (timing > Scene_RPGmania.NOTETIMINGS.GREAT) {
                        // GOOD
                        this._score += 200;
                        this._combo++;
                        this.setRankText(2);
                        SceneManager._scene.rankings[2]++;
                    } else if (timing > Scene_RPGmania.NOTETIMINGS.PERFECT) {
                        // GREAT
                        this._score += 500;
                        this._combo++;
                        this.setRankText(3);
                        SceneManager._scene.rankings[3]++;
                    } else {
                        // PERFECT
                        this._score += 1000;
                        this._combo++;
                        this.setRankText(4);
                        SceneManager._scene.rankings[4]++;
                    }

                    if(this._highest_combo < this._combo) {
                        this._highest_combo = this._combo;
                    }

                    continue;
            }
        }
        cur++;
    }
}

Scene_RPGmania.prototype.setRankText = function(rank) {
    this._rankText.timer = 50;
    let w = this.comboTextWidth();
    let h = this.comboDigitHeight();
    let row = Math.floor(rank / 2);
    this._rankText.setFrame(w * (rank % 2), h * (row + 1), w, h);
}

Scene_RPGmania.prototype.updateHeldNotes = function(heldBitmap) {
    let heldNotes = this._objectPoolManager._held;
    let cull = [];
    heldNotes.forEach(hold => {
        if(hold.heldDown) {
            if(!(1 << hold.dir & heldBitmap)) {
                cull.push(hold);
            } else {
                this._score += 10;
            }
        }
    });

    cull.forEach(x => this._objectPoolManager.releaseHeld(x));
}

// ----------------------------
//    Window_SongList 
//  Create a chart of selectable songs
// ----------------------------
function Window_SongList() {
    this.initialize.apply(this, arguments);
}

Window_SongList.prototype = Object.create(Window_Selectable.prototype);
Window_SongList.prototype.constructor = Window_SongList;

Window_SongList.prototype.initialize = function(x, y, width, height) {
    Window_Selectable.prototype.initialize.call(this, x, y, width, height);
    this._data = [];

    this.setHandler('ok',     this.onSongSelect.bind(this));
    this.setHandler('cancel', () => SceneManager.pop());

    GH_RPGmania.getChartNames((chartNames) => {
        chartNames.forEach(chartName => GH_RPGmania.loadChart(chartName));
    });

    this.refresh();

    this.activate();

    this._needRefresh = false;

    // reorg
    this.removeChild(this._windowCursorSprite);
    this.addChild(this._windowCursorSprite);

    this.diffWindow = new Window_DifficultySelect(this);
};

Window_SongList.prototype.update = function() {
    Window_Selectable.prototype.update.call(this);
    if(GH_RPGmania.charts && Object.keys(GH_RPGmania.charts).length != this._data.length) {
        this.updateData();
    }

    if(this._needRefresh && this._data.every(d => d.bitmap._loadingState == "loaded")) {
        this.refresh();
        this._needRefresh = false;
    }
}

Window_SongList.prototype.updateData = function() {
    this._data = Object.values(GH_RPGmania.charts);
    this._data.forEach( c => {
        c.bitmap = ImageManager.loadBitmap(GH_RPGmania.CHARTSFOLDER + c.CHARTNAME + "/", (c.BANNER.replace(/.png|.jpeg|.jpg/gi, "")), 0, true);
    });

    this._needRefresh = true;
}

Window_SongList.prototype.refresh = function() {
    this.contents.clear();
    this.drawAllItems();
    if(this._data && this._data.length > 1 && this.index() == -1) {
        this.select(0);
    }
};

Window_SongList.prototype.onSongSelect = function() {
    if(!this._data || !this._data[this._index]) return;
    let chart = this._data[this._index];
    let difficulties = Object.keys(chart.NOTES);

    this.deactivate();
    this.diffWindow.setup(difficulties,chart.CHARTNAME);
}

Window_SongList.prototype.maxCols = function() {
    return Math.floor(this.width / this.itemWidth());
};

Window_SongList.prototype.itemWidth = function() {
    return 256;
};

Window_SongList.prototype.itemHeight = function() {
    return 80;
};

Window_SongList.prototype.maxItems = function() {
    return this._data ? this._data.length : 0;
};

Window_SongList.prototype.drawItem = function(index) {
    let chart = this._data[index];
    let rect = this.itemRect(index);

    this.contents.blt(chart.bitmap, 0, 0, chart.bitmap.width, chart.bitmap.height, rect.x, rect.y, rect.width, rect.height);
};

// ----------------------------
//    Window_DifficultySelect 
//  small window for difficulty
// ----------------------------
function Window_DifficultySelect() {
    this.initialize.apply(this, arguments);
}

Window_DifficultySelect.prototype = Object.create(Window_Command.prototype);
Window_DifficultySelect.prototype.constructor = Window_DifficultySelect;

Window_DifficultySelect.prototype.initialize = function(parentW) {
    Window_Command.prototype.initialize.call(this, Graphics.boxWidth / 2, Graphics.boxHeight / 2);
    
    this.parentWindow = parentW;

    this.setHandler('ok',     this.onSelect.bind(this));
    this.setHandler('cancel', this.onCancel.bind(this));
    
    this.deactivate();
    this.hide();
};

Window_DifficultySelect.prototype.setup = function(difficulties, songName) {
    this._data = difficulties;
    this._songName = songName;
    this.refresh();

    this.open();
    this.show();

    this.activate();

    this.x = Graphics.boxWidth / 2 - this.width / 2;
    this.y = Graphics.boxHeight / 2 - this.height / 2;
}

Window_DifficultySelect.prototype.makeCommandList = function() {
    if(!this._data) return;
    for(let i = 0; i < this._data.length; i++) {
        this.addCommand(this._data[i], "ok", true);
    }
}

Window_DifficultySelect.prototype.onCancel = function() {
    this.close();
    this.deactivate();
    this.parentWindow.activate();
}

Window_DifficultySelect.prototype.onSelect = function() {
    let diff = this._data[this._index];

    $gameSystem._rpgmania_data = {
        songList: false,
        songName: this._songName,
        difficulty: diff,
        useActorImage: true,
    };

    // clear charts
    GH_RPGmania.charts = undefined;

    SceneManager._scene.fadeOutAll();
    SceneManager.push(Scene_RPGmania);
}

Window_DifficultySelect.prototype.maxCols = function() {
    return 1;
};

Window_DifficultySelect.prototype.numVisibleRows = function() {
    return 4;
};


// Cubemap frame code
// let cW = this._skybox_imgs[0].width / 4;
// this._skybox[0].setFrame(0, cW, cW, cW);
// this._skybox[1].setFrame(cW, cW, cW, cW);
// this._skybox[2].setFrame(cW * 2, cW, cW, cW);
// this._skybox[3].setFrame(cW * 3, cW, cW, cW);
// this._skybox[4].setFrame(cW, 0, cW, cW);
// this._skybox[5].setFrame(cW, cW * 2, cW, cW);


// Extend pixi projection
PIXI.projection.Sprite3d.prototype.setFrame = function(x, y, width, height) {
    if(!this.texture || !this.texture.baseTexture.hasLoaded) return;
    let w = Math.min(this.texture.baseTexture.width, width);
    let h = Math.min(this.texture.baseTexture.height, height);
    this.texture.frame.x = x;
    this.texture.frame.y = y;
    this.texture.frame.width = w;
    this.texture.frame.height = h;
    this.texture._updateUvs();
};
