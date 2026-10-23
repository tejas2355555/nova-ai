/* =========================================================
   NOVA AI — PUTER.JS
   SAFE CHAT IMPLEMENTATION
   ========================================================= */

const input = document.getElementById("input");
const send = document.getElementById("send");
const stop = document.getElementById("stop");
const model = document.getElementById("model");

const welcome = document.getElementById("welcome");
const messages = document.getElementById("messages");

const sidebar = document.getElementById("sidebar");
const overlay = document.getElementById("overlay");

const historyList =
    document.getElementById("historyList");

const chatName =
    document.getElementById("chatName");

const toast =
    document.getElementById("toast");

const fileInput =
    document.getElementById("fileInput");

const filePill =
    document.getElementById("filePill");

const fileName =
    document.getElementById("fileName");


/* =========================================================
   STATE
   ========================================================= */

let chats =
    JSON.parse(
        localStorage.getItem("nova_chats") || "[]"
    );

let currentChatId =
    localStorage.getItem("nova_current_chat");

let generating = false;

let stopped = false;

let generationId = 0;

let attachedFile = null;


/* =========================================================
   CHAT OBJECT
   ========================================================= */

function createChat(){

    return {
        id:
            Date.now().toString(),

        title:
            "New conversation",

        model:
            model.value,

        messages:
            []
    };
}


function getChat(){

    let chat =
        chats.find(
            c => c.id === currentChatId
        );

    if(!chat){

        chat = createChat();

        chats.unshift(chat);

        currentChatId =
            chat.id;
    }

    return chat;
}


/* =========================================================
   STORAGE
   ========================================================= */

function save(){

    localStorage.setItem(
        "nova_chats",
        JSON.stringify(chats)
    );

    localStorage.setItem(
        "nova_current_chat",
        currentChatId
    );
}


/* =========================================================
   HISTORY
   ========================================================= */

function renderHistory(){

    historyList.innerHTML = "";

    chats.slice(0,20).forEach(chat => {

        const div =
            document.createElement("div");

        div.className =
            "history-item";

        div.textContent =
            chat.title || "New conversation";

        if(chat.id === currentChatId){

            div.style.background =
                "var(--panel2)";
        }

        div.onclick = () => {

            currentChatId =
                chat.id;

            model.value =
                chat.model || "gpt-5";

            save();

            renderChat();

            closeMobileMenu();
        };

        historyList.appendChild(div);
    });
}


/* =========================================================
   RENDER CHAT
   ========================================================= */

function renderChat(){

    const chat =
        getChat();

    messages.innerHTML = "";

    chatName.textContent =
        chat.title || "New conversation";

    if(chat.messages.length === 0){

        welcome.style.display =
            "flex";

        messages.style.display =
            "none";

        return;
    }

    welcome.style.display =
        "none";

    messages.style.display =
        "block";

    chat.messages.forEach(message => {

        addMessage(
            message.role,
            message.content
        );
    });

    scroll();

    renderHistory();
}


/* =========================================================
   SAFE PUTER RESPONSE PARSER
   ========================================================= */

function extractPuterText(chunk){

    if(chunk == null){
        return "";
    }


    /* Direct string */

    if(typeof chunk === "string"){
        return chunk;
    }


    /* Standard chunk */

    if(typeof chunk.text === "string"){
        return chunk.text;
    }


    /* Direct content */

    if(typeof chunk.content === "string"){
        return chunk.content;
    }


    /* message.content */

    if(
        chunk.message &&
        typeof chunk.message.content === "string"
    ){

        return chunk.message.content;
    }


    /* choices */

    if(
        Array.isArray(chunk.choices) &&
        chunk.choices.length
    ){

        const choice =
            chunk.choices[0];


        if(
            choice.delta &&
            typeof choice.delta.content === "string"
        ){

            return choice.delta.content;
        }


        if(
            choice.message &&
            typeof choice.message.content === "string"
        ){

            return choice.message.content;
        }


        if(typeof choice.text === "string"){

            return choice.text;
        }
    }


    /*
     * Some APIs may return an array
     * of content parts.
     */

    if(Array.isArray(chunk.content)){

        return chunk.content
            .map(part => {

                if(typeof part === "string"){
                    return part;
                }

                return part?.text || "";
            })
            .join("");
    }


    return "";
}


/* =========================================================
   FINAL RESPONSE PARSER
   ========================================================= */

function extractPuterFinalText(response){

    if(!response){
        return "";
    }


    const direct =
        extractPuterText(response);

    if(direct){
        return direct;
    }


    const candidates = [

        response.message?.content,

        response.response?.message?.content,

        response.result?.message?.content,

        response.result?.content,

        response.output?.text,

        response.output?.[0]?.content?.[0]?.text,

        response.choices?.[0]?.message?.content,

        response.choices?.[0]?.text

    ];


    for(const value of candidates){

        if(
            typeof value === "string" &&
            value.trim()
        ){

            return value;
        }
    }


    return "";
}


/* =========================================================
   PUTER READY CHECK
   ========================================================= */

function isPuterReady(){

    return (
        typeof puter !== "undefined" &&
        puter.ai &&
        typeof puter.ai.chat === "function"
    );
}


/* =========================================================
   SEND MESSAGE
   ========================================================= */

async function sendMessage(){

    if(generating){
        return;
    }


    if(!isPuterReady()){

        notify(
            "Puter AI is still loading. Please wait a moment."
        );

        return;
    }


    const prompt =
        input.value.trim();


    if(!prompt){
        return;
    }


    const chat =
        getChat();


    /*
     * New generation ID.
     */

    const myGeneration =
        ++generationId;


    generating =
        true;

    stopped =
        false;


    send.style.display =
        "none";

    stop.style.display =
        "inline-grid";

    stop.disabled =
        false;


    /*
     * Set title.
     */

    if(chat.messages.length === 0){

        chat.title =
            prompt.length > 42
                ? prompt.substring(0,42) + "..."
                : prompt;
    }


    chat.model =
        model.value;


    /*
     * User message.
     */

    chat.messages.push({

        role:
            "user",

        content:
            prompt

    });


    save();

    renderHistory();


    /*
     * Clear composer.
     */

    input.value = "";

    autoResize();


    /*
     * Show conversation.
     */

    welcome.style.display =
        "none";

    messages.style.display =
        "block";


    addMessage(
        "user",
        prompt
    );


    scroll();


    /*
     * Temporary assistant message.
     */

    const live =
        addMessage(
            "assistant",
            "",
            true
        );


    let answer = "";


    try{

        /*
         * Clean API messages.
         */

        const apiMessages =
            chat.messages.map(message => ({

                role:
                    message.role,

                content:
                    message.content

            }));


        /*
         * Ask Puter for streaming response.
         */

        const response =
            await puter.ai.chat(
                apiMessages,
                {
                    model:
                        model.value,

                    stream:
                        true
                }
            );


        /*
         * -----------------------------------------
         * STREAMING
         * -----------------------------------------
         */

        if(
            response &&
            typeof response[Symbol.asyncIterator]
                === "function"
        ){

            for await(
                const chunk of response
            ){

                /*
                 * User stopped this generation.
                 */

                if(
                    stopped ||
                    myGeneration !== generationId
                ){

                    break;
                }


                const text =
                    extractPuterText(chunk);


                /*
                 * Ignore metadata chunks.
                 */

                if(!text){
                    continue;
                }


                answer +=
                    text;


                /*
                 * Update temporary UI.
                 */

                if(live.text){

                    live.text.innerHTML =
                        format(answer);
                }


                scroll();
            }

        }else{

            /*
             * -----------------------------------------
             * NON-STREAM FALLBACK
             * -----------------------------------------
             */

            answer =
                extractPuterFinalText(
                    response
                );
        }


        /*
         * Final parser fallback.
         */

        if(!answer){

            const fallback =
                extractPuterFinalText(
                    response
                );

            if(fallback){
                answer =
                    fallback;
            }
        }


        /*
         * If generation was stopped.
         */

        if(stopped){

            if(answer){

                answer +=
                    "\n\n[Generation stopped]";

            }else{

                answer =
                    "[Generation stopped]";
            }
        }


        /*
         * Nothing returned.
         */

        if(!answer){

            answer =
                "I didn't receive a response from Puter AI. Please try again.";
        }


        /*
         * IMPORTANT:
         *
         * Don't allow an old generation to
         * overwrite a newer chat.
         */

        if(
            myGeneration !== generationId
        ){

            return;
        }


        /*
         * Save assistant response.
         */

        chat.messages.push({

            role:
                "assistant",

            content:
                answer

        });


        save();


        /*
         * Replace live message.
         */

        if(live.wrapper){

            live.wrapper.remove();
        }


        addMessage(
            "assistant",
            answer
        );


        scroll();


    }catch(error){

        console.error(
            "Puter AI error:",
            error
        );


        /*
         * If this is an old request,
         * don't modify the UI.
         */

        if(
            myGeneration !== generationId
        ){

            return;
        }


        let errorMessage =
            "Sorry, I couldn't generate a response.";


        if(
            error &&
            error.message
        ){

            errorMessage +=
                "\n\n" +
                error.message;
        }


        /*
         * Preserve partial answer.
         */

        const finalAnswer =
            answer
                ? answer +
                  "\n\n[Generation interrupted]"
                : errorMessage;


        chat.messages.push({

            role:
                "assistant",

            content:
                finalAnswer

        });


        save();


        if(live.text){

            live.text.innerHTML =
                format(finalAnswer);
        }


        scroll();


    }finally{

        /*
         * ALWAYS restore UI.
         */

        if(
            myGeneration === generationId
        ){

            generating =
                false;

            stopped =
                false;

            send.style.display =
                "inline-grid";

            stop.style.display =
                "none";

            stop.disabled =
                false;

            renderHistory();

            input.focus();
        }
    }
}


/* =========================================================
   STOP GENERATION
   ========================================================= */

stop.onclick = function(){

    if(!generating){
        return;
    }


    /*
     * Invalidate current generation.
     */

    generationId++;


    stopped =
        true;


    stop.disabled =
        true;


    notify(
        "Generation stopped."
    );


    /*
     * The Puter SDK may continue the underlying
     * network request, but its remaining chunks
     * are ignored and cannot overwrite the UI.
     */

    generating =
        false;


    send.style.display =
        "inline-grid";

    stop.style.display =
        "none";

    stop.disabled =
        false;
};


/* =========================================================
   ADD MESSAGE
   ========================================================= */

function addMessage(
    role,
    content,
    temporary = false
){

    const wrapper =
        document.createElement("div");

    wrapper.className =
        "message " + role;


    const avatar =
        document.createElement("div");

    avatar.className =
        "avatar";

    avatar.textContent =
        role === "user"
            ? "YOU"
            : "N";


    const body =
        document.createElement("div");

    body.className =
        "message-body";


    const label =
        document.createElement("div");

    label.className =
        "message-label";

    label.textContent =
        role === "user"
            ? "You"
            : "NOVA AI";


    const text =
        document.createElement("div");

    text.className =
        "message-content";


    if(
        temporary &&
        !content
    ){

        text.innerHTML = `
            <div class="typing">
                <span></span>
                <span></span>
                <span></span>
            </div>
        `;

    }else{

        text.innerHTML =
            format(content);
    }


    body.appendChild(label);

    body.appendChild(text);


    if(!temporary){

        const actions =
            document.createElement("div");

        actions.className =
            "message-actions";


        const copy =
            document.createElement("button");

        copy.textContent =
            "Copy";

        copy.onclick = () => {

            navigator.clipboard
                ?.writeText(content);

            notify("Copied");
        };


        actions.appendChild(copy);


        if(role === "assistant"){

            const speak =
                document.createElement("button");

            speak.textContent =
                "Read aloud";

            speak.onclick = () =>
                speakText(content);

            actions.appendChild(speak);
        }


        body.appendChild(actions);
    }


    wrapper.appendChild(avatar);

    wrapper.appendChild(body);

    messages.appendChild(wrapper);


    return {
        wrapper,
        text
    };
}


/* =========================================================
   MARKDOWN-LIKE FORMATTER
   ========================================================= */

function escapeHTML(text){

    return String(text)
        .replace(/&/g,"&amp;")
        .replace(/</g,"&lt;")
        .replace(/>/g,"&gt;")
        .replace(/"/g,"&quot;")
        .replace(/'/g,"&#039;");
}


function format(text){

    if(!text){
        return "";
    }


    let safe =
        escapeHTML(text);


    /*
     * Code blocks.
     */

    safe =
        safe.replace(
            /```([\w+-]*)\n?([\s\S]*?)```/g,
            function(_,lang,code){

                const id =
                    "code_" +
                    Math.random()
                        .toString(36)
                        .slice(2);


                return `
                    <div class="code-wrap">

                        <button
                            class="copy-code"
                            onclick="copyCode('${id}')"
                        >
                            Copy
                        </button>

                        <pre>
                            <code id="${id}">${code.trim()}</code>
                        </pre>

                    </div>
                `;
            }
        );


    /*
     * Bold.
     */

    safe =
        safe.replace(
            /\*\*(.*?)\*\*/g,
            "<strong>$1</strong>"
        );


    /*
     * Italic.
     */

    safe =
        safe.replace(
            /(?<!\*)\*([^*]+)\*(?!\*)/g,
            "<em>$1</em>"
        );


    /*
     * Inline code.
     */

    safe =
        safe.replace(
            /`([^`]+)`/g,
            '<span class="inline-code">$1</span>'
        );


    /*
     * Links.
     */

    safe =
        safe.replace(
            /(https?:\/\/[^\s<]+)/g,
            '<a href="$1" target="_blank" rel="noopener">$1</a>'
        );


    /*
     * New lines.
     */

    safe =
        safe.replace(
            /\n/g,
            "<br>"
        );


    return safe;
}


/* =========================================================
   COPY CODE
   ========================================================= */

function copyCode(id){

    const el =
        document.getElementById(id);

    if(!el){
        return;
    }

    navigator.clipboard
        ?.writeText(el.innerText);

    notify("Code copied");
}


/* =========================================================
   QUICK PROMPT
   ========================================================= */

function quickPrompt(text){

    input.value =
        text;

    autoResize();

    input.focus();

    if(window.innerWidth <= 760){

        closeMobileMenu();
    }
}


/* =========================================================
   INPUT
   ========================================================= */

input.addEventListener(
    "input",
    autoResize
);


function autoResize(){

    input.style.height =
        "auto";

    input.style.height =
        Math.min(
            input.scrollHeight,
            180
        ) + "px";
}


input.addEventListener(
    "keydown",
    event => {

        if(
            event.key === "Enter" &&
            !event.shiftKey
        ){

            event.preventDefault();

            sendMessage();
        }
    }
);


/* =========================================================
   SEND BUTTON
   ========================================================= */

send.onclick =
    sendMessage;


/* =========================================================
   NEW CHAT
   ========================================================= */

document
    .getElementById("newChat")
    .onclick = () => {

        if(generating){

            generationId++;

            stopped = true;

            generating = false;
        }


        const chat =
            createChat();


        chats.unshift(chat);

        currentChatId =
            chat.id;


        save();

        renderChat();

        renderHistory();

        closeMobileMenu();

        input.focus();
    };


/* =========================================================
   CLEAR CHAT
   ========================================================= */

document
    .getElementById("clearBtn")
    .onclick = () => {

        const chat =
            getChat();

        chat.messages = [];

        chat.title =
            "New conversation";

        save();

        renderChat();

        notify("Chat cleared");
    };


/* =========================================================
   MODEL
   ========================================================= */

model.addEventListener(
    "change",
    () => {

        const chat =
            getChat();

        chat.model =
            model.value;

        save();
    }
);


/* =========================================================
   THEME
   ========================================================= */

const savedTheme =
    localStorage.getItem("nova_theme");


if(savedTheme === "dark"){

    document.body.classList.add("dark");
}


document
    .getElementById("themeBtn")
    .onclick = () => {

        document.body.classList.toggle("dark");

        localStorage.setItem(
            "nova_theme",
            document.body.classList.contains("dark")
                ? "dark"
                : "light"
        );
    };


/* =========================================================
   FILE ATTACHMENT
   ========================================================= */

document
    .getElementById("attachBtn")
    .onclick = () => {

        fileInput.click();
    };


fileInput.addEventListener(
    "change",
    async () => {

        const file =
            fileInput.files[0];

        if(!file){
            return;
        }


        attachedFile =
            file;


        fileName.textContent =
            file.name;


        filePill.style.display =
            "flex";


        /*
         * For text files, automatically add
         * their contents to the composer.
         */

        if(
            file.type.startsWith("text/") ||
            /\.(txt|md|js|html|css|json|csv)$/i
                .test(file.name)
        ){

            try{

                const text =
                    await file.text();

                input.value +=
                    "\n\nAttached file:\n" +
                    text;

                autoResize();

            }catch(error){

                console.error(error);
            }
        }
    }
);


/* =========================================================
   REMOVE FILE
   ========================================================= */

document
    .getElementById("removeFile")
    .onclick = () => {

        attachedFile =
            null;

        fileInput.value =
            "";

        filePill.style.display =
            "none";
    };


/* =========================================================
   VOICE INPUT
   ========================================================= */

const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;


document
    .getElementById("micBtn")
    .onclick = () => {

        if(!SpeechRecognition){

            notify(
                "Voice input isn't supported in this browser."
            );

            return;
        }


        const recognition =
            new SpeechRecognition();


        recognition.lang =
            "en-US";


        recognition.interimResults =
            true;


        recognition.continuous =
            false;


        recognition.onstart = () => {

            notify("Listening...");
        };


        recognition.onresult =
            event => {

                let result = "";

                for(
                    let i = event.resultIndex;
                    i < event.results.length;
                    i++
                ){

                    result +=
                        event.results[i][0].transcript;
                }


                input.value =
                    result;

                autoResize();
            };


        recognition.onerror =
            () => {

                notify(
                    "Voice input failed."
                );
            };


        recognition.start();
    };


/* =========================================================
   TEXT TO SPEECH
   ========================================================= */

function speakText(text){

    if(!("speechSynthesis" in window)){

        notify(
            "Text-to-speech isn't supported."
        );

        return;
    }


    speechSynthesis.cancel();


    const utterance =
        new SpeechSynthesisUtterance(
            text
        );


    utterance.rate =
        .95;


    speechSynthesis.speak(
        utterance
    );
}


/* =========================================================
   SHARE
   ========================================================= */

document
    .getElementById("shareBtn")
    .onclick = async () => {

        const chat =
            getChat();


        const text =
            chat.messages
                .map(
                    m =>
                        `${m.role.toUpperCase()}:\n${m.content}`
                )
                .join("\n\n");


        if(
            navigator.share
        ){

            try{

                await navigator.share({

                    title:
                        chat.title,

                    text:
                        text
                });

            }catch(error){}
        }else{

            await navigator.clipboard
                ?.writeText(text);

            notify(
                "Chat copied to clipboard"
            );
        }
    };


/* =========================================================
   EXPORT
   ========================================================= */

document
    .getElementById("exportBtn")
    .onclick = () => {

        const chat =
            getChat();


        const content =
            chat.messages
                .map(
                    m =>
                        `${m.role.toUpperCase()}\n\n${m.content}`
                )
                .join("\n\n----------------\n\n");


        const blob =
            new Blob(
                [content],
                {
                    type:
                        "text/plain"
                }
            );


        const url =
            URL.createObjectURL(blob);


        const a =
            document.createElement("a");


        a.href =
            url;


        a.download =
            (
                chat.title ||
                "nova-chat"
            )
            .replace(
                /[^a-z0-9]/gi,
                "_"
            )
            + ".txt";


        a.click();


        URL.revokeObjectURL(url);

        notify("Chat exported");
    };


/* =========================================================
   MOBILE MENU
   ========================================================= */

document
    .getElementById("menuBtn")
    .onclick = () => {

        sidebar.classList.add("open");

        overlay.classList.add("show");
    };


overlay.onclick =
    closeMobileMenu;


function closeMobileMenu(){

    sidebar.classList.remove("open");

    overlay.classList.remove("show");
}


/* =========================================================
   SCROLL
   ========================================================= */

function scroll(){

    requestAnimationFrame(() => {

        const area =
            document.getElementById("chatArea");

        area.scrollTop =
            area.scrollHeight;
    });
}


/* =========================================================
   TOAST
   ========================================================= */

let toastTimer;


function notify(text){

    toast.textContent =
        text;

    toast.classList.add("show");


    clearTimeout(
        toastTimer
    );


    toastTimer =
        setTimeout(
            () => {

                toast.classList.remove(
                    "show"
                );

            },
            2200
        );
}


/* =========================================================
   INITIALIZE
   ========================================================= */

if(!chats.length){

    const first =
        createChat();

    chats.push(first);

    currentChatId =
        first.id;

}else if(
    !currentChatId ||
    !chats.some(
        c => c.id === currentChatId
    )
){

    currentChatId =
        chats[0].id;
}


const initialChat =
    getChat();


model.value =
    initialChat.model ||
    "gpt-5";


save();

renderHistory();

renderChat();

autoResize();

input.focus();


/*
 * Puter availability notification.
 */

setTimeout(() => {

    if(!isPuterReady()){

        notify(
            "Puter AI is still loading..."
        );
    }

}, 1500);
