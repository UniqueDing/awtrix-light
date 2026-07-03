
/*
 * This HTML code will be injected in /setup webpage using a <div></div> element as parent
 * The parent element will hhve the HTML id properties equal to 'raw-html-<id>'
 * where the id value will be equal to the id parameter passed to the function addHTML(html_code, id).
 */
static const char custom_html[] PROGMEM = R"EOF(
  <div id="iconcontent">
        <div id="form-con">
            <form>
                <label for="lametric-iconID">Icon ID</label><br>
                <input type="text" id="lametric-iconID" name="lametric-iconID"><br>
                <div class="button-row">
                    <input class="btn" type="button" value="Preview" onclick="createLametricLink()">
                    <input class="btn" type="button" value="Download" onclick="downloadLametricImage()">
                </div>
            </form>
        </div>
        <br>
        <br>
        <div id="icon-container">
        </div>
    </div>
)EOF";

static const char custom_css[] PROGMEM = R"EOF(
        .iconcontent {
            width: 50%;
            justify-content: center;
        }
        #form-con {
            width: 50%;
            margin: 0 auto;
            min-width: 200px;
        }
        .button-row input {
            width: 50%;
            margin: 0 5px;
        }
        .button-row {
            display: flex;
            justify-content: space-evenly;
            margin: 0 -5px;
            margin-top: 5px;
        }
        #icon-container {
            margin: 0 auto;
            max-width: 150px;
            max-height: 150px;
            width: 150px;
            background-color: black;
            height: 150px;
            margin: 0 auto;
        }
        #icon-container img {
            image-rendering: pixelated;
            max-width: 150px;
            max-height: 150px;
            width: 150px;
            background-color: black;
            height: 150px;
        }
	)EOF";

static const char custom_script[] PROGMEM = R"EOF(
function createLametricLink(){const e=document.getElementById("lametric-iconID").value,t=document.createElement("img");t.onerror=function(){openModalMessage("Error","<b>This ID doesnt exist</b>")},t.src="https://developer.lametric.com/content/apps/icon_thumbs/"+e;const n=document.getElementById("icon-container");n.innerHTML="",n.appendChild(t)}async function downloadLametricImage(){const e=document.getElementById("lametric-iconID").value;try{let n=await fetch("https://developer.lametric.com/content/apps/icon_thumbs/"+e),o=await n.blob();var t="";const c=n.headers.get("content-type");if("image/jpeg"===c||"image/png"===c){t=".jpg";let n=new Image,c=URL.createObjectURL(o);n.onload=function(){let o=document.createElement("canvas");o.width=n.width,o.height=n.height,o.getContext("2d").drawImage(n,0,0,n.width,n.height),o.toBlob((function(n){sendBlob(n,e,t)}),"image/jpeg",1),URL.revokeObjectURL(c)},n.src=c}else"image/gif"===n.headers.get("content-type")&&sendBlob(o,e,t=".gif")}catch(e){console.log("Error"),openModalMessage("Error","<b>This ID doesnt exist</b>")}}function sendBlob(e,t,n){const o=new FormData;o.append("image",e,"ICONS/"+t+n),fetch("/edit",{method:"POST",body:o,mode:"no-cors"}).then((e=>{e.ok&&openModalMessage("Finish","<b>Icon saved</b>")})).catch((e=>{console.log(e)}))}
)EOF";

static const char screenfull_html[] PROGMEM = R"EOF(
<!doctype html><html> <head> <title>LiveView</title> <style>body{display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; overflow: hidden; background: #000;}canvas{display: block; width: 100vw; background: #000; z-index: 1;}</style> </head> <body><canvas id=c></canvas></body> <script>const c=document.getElementById("c"), d=c.getContext("2d");const urlParams=new URLSearchParams(window.location.search);const queriedFPS=parseInt(urlParams.get('fps'));let fps=%%FPS%%;function scd(){const t=window.innerWidth; c.width=t, c.height=t / 4;}function j(){fetch("/api/screen").then(t=> t.json()).then(t=>{d.clearRect(0, 0, c.width, c.height); d.fillStyle="#000"; for (let e=0; e < 8; e++) for (let n=0; n < 32; n++){const i=t[32 * e + n], o=(16711680 & i) >> 16, s=(65280 & i) >> 8, h=255 & i; d.fillStyle=`rgb(${o},${s},${h})`; d.fillRect(n * (c.width / 32), e * (c.height / 8), c.width / 32 - 4, c.height / 8 - 4);}setTimeout(j, 1000 / fps);});}scd();document.addEventListener("DOMContentLoaded", j);window.addEventListener("resize", scd); </script></html>
)EOF";