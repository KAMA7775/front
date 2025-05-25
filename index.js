//const API_KEY = "AIzaSyC34a5nvlW-CXflWbPGLZims8gZY2bb3lI";
const GEMINI_API_KEY = 'AIzaSyC34a5nvlW-CXflWbPGLZims8gZY2bb3lI';

const chatWindow = document.getElementById('chat-window');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const voiceBtn = document.getElementById('voice-btn');
const ttsResponseBtn = document.getElementById('tts-response-btn');
const ovzModeSelect = document.getElementById('ovz-mode');
const statusText = document.getElementById('status');

let lastResponseText = '';
let isSpeaking = false;
let recognition = null;

function addMessage(text, fromUser = true) {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message');
    msgDiv.textContent = text;
    msgDiv.classList.add(fromUser ? 'user-msg' : 'bot-msg');
    chatWindow.appendChild(msgDiv);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

function setStatus(text) {
    statusText.textContent = text;
}

function speak(text) {
    if (!window.speechSynthesis) {
        alert('Сиздин браузерде үн менен окуу колдоосу жок.');
        return;
    }
    if (isSpeaking) {
        window.speechSynthesis.cancel();
    }

    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const kyVoice = voices.find(v => v.lang.startsWith('ky') || v.lang.startsWith('ru'));
    if (kyVoice) {
        utterance.voice = kyVoice;
    }
    utterance.rate = 0.9;

    utterance.onstart = () => {
        isSpeaking = true;
        ttsResponseBtn.textContent = 'Окууну токтотуу';
    };
    utterance.onend = () => {
        isSpeaking = false;
        ttsResponseBtn.textContent = 'Жоопту окуу';
    };
    window.speechSynthesis.speak(utterance);
}

ttsResponseBtn.onclick = () => {
    if (isSpeaking) {
        window.speechSynthesis.cancel();
    } else if (lastResponseText) {
        speak(lastResponseText);
    }
};

function setupSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        voiceBtn.disabled = true;
        voiceBtn.title = 'Браузериңизде добуш менен жазуу колдоосу жок';
        return;
    }

    recognition = new SpeechRecognition();
    recognition.lang = 'ky-KG';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
        setStatus('Добушту жазууда...');
        voiceBtn.textContent = '⏹️';
    };
    recognition.onend = () => {
        setStatus('');
        voiceBtn.textContent = '🎤';
    };
    recognition.onerror = (event) => {
        setStatus('Ката: ' + event.error);
    };
    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        userInput.value = transcript;
        setStatus('Добуш жыйынтыкталды.');
    };

    voiceBtn.onclick = () => {
        if (recognition && recognition.running) {
            recognition.stop();
        } else if (recognition) {
            recognition.start();
        }
    };
}

setupSpeechRecognition();

function getPromptForMode(userText, mode) {
    switch (mode) {
        case 'slabovid':
            return `Сиз көзү начар көргөндөр үчүн жооп бериңиз. Текст чоң, түшүнүктүү жана жеңил болсун. Колдонуучу мындай деп сурады: "${userText}"`;
        case 'intellekt':
            return `Жоопту жөнөкөй жана ачык тилде бериңиз, акыл-эсинин чектелген колдонуучулардын түшүнүүсү үчүн. Колдонуучу суроосу: "${userText}"`;
        case 'slaboslysh':
            return `Жоопту жеңил жана ачык жазып бериңиз, угуусу кыйын адамдар үчүн. Колдонуучу: "${userText}"`;
        default:
            return userText;
    }
}

async function callGeminiAPI(promptText) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
    const headers = {
        'Content-Type': 'application/json'
    };

    const body = JSON.stringify({
        contents: [
            {
                parts: [
                    {
                        text: promptText
                    }
                ]
            }
        ],
        generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 500,
            topP: 0.8,
            topK: 10
        }
    });

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers,
            body
        });
        if (!response.ok) {
            throw new Error('Сервер жооп бербеди: ' + response.status);
        }
        const data = await response.json();
        const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Жооп жок';
        return aiText;
    } catch (err) {
        console.error('API чакырууда ката:', err);
        return 'Кечиресиз, учурда жооп алуу мүмкүн эмес.';
    }
}

const STORAGE_KEY = 'ovz_chat_history';

function saveHistory(history) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

function loadHistory() {
    const historyStr = localStorage.getItem(STORAGE_KEY);
    if (!historyStr) return [];
    try {
        return JSON.parse(historyStr);
    } catch {
        return [];
    }
}

function renderHistory(history) {
    chatWindow.innerHTML = '';
    for (const entry of history) {
        addMessage(entry.text, entry.fromUser);
    }
}

let chatHistory = loadHistory();
renderHistory(chatHistory);

sendBtn.onclick = async () => {
    const userText = userInput.value.trim();
    if (!userText) return;

    addMessage(userText, true);
    chatHistory.push({ text: userText, fromUser: true });
    saveHistory(chatHistory);

    userInput.value = '';
    setStatus('Жооп күтүлүүдө...');
    ttsResponseBtn.style.display = 'none';

    const mode = ovzModeSelect.value;
    const prompt = getPromptForMode(userText, mode);

    const aiResponse = await callGeminiAPI(prompt);

    addMessage(aiResponse, false);
    chatHistory.push({ text: aiResponse, fromUser: false });
    saveHistory(chatHistory);

    lastResponseText = aiResponse;
    ttsResponseBtn.style.display = 'inline-block';
    setStatus('');
};

userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Жиберуу') {
        e.preventDefault();
        sendBtn.click();
    }
});

ovzModeSelect.addEventListener('change', () => {
    // Настройки при смене режима
});


// const messagesDiv = document.getElementById('messages');
// const loadingDiv = document.getElementById('loading');
// const sendBtn = document.getElementById('sendBtn');
// const userInput = document.getElementById('userInput');
//
// function appendMessage(role, text) {
//     const div = document.createElement('div');
//     div.className = 'message ' + (role === 'user' ? 'user' : 'bot');
//     div.textContent = (role === 'user' ? 'Сиз: ' : 'ИИ: ') + text;
//     messagesDiv.appendChild(div);
//     messagesDiv.scrollTop = messagesDiv.scrollHeight; // Автоскролл вниз
// }
//
// function adaptText(text, disability) {
//     if (disability === 'cognitive') {
//         return text.replace(/[,;:]/g, '.').split('.').map(s => s.trim()).filter(Boolean).join('. ') + '.';
//     }
//     if (disability === 'hearing') {
//         return text + ' 💬';
//     }
//     if (disability === 'visual') {
//         return text.toUpperCase();
//     }
//     if (disability === 'autism') {
//         return text + '\n\n(Кайра кайталадым: ' + text + ')';
//     }
//     return text;
// }
//
// async function sendMessage() {
//     const userText = userInput.value.trim();
//     const disability = document.getElementById('disability').value;
//     if (!userText) return;
//
//     appendMessage('user', userText);
//     userInput.value = '';
//     sendBtn.disabled = true;
//     loadingDiv.style.display = 'block';
//
//     const payload = {
//         contents: [
//             {
//                 parts: [{ text: userText }]
//             }
//         ]
//     };
//
//     try {
//         const res = await fetch(
//             `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`,
//             {
//                 method: 'POST',
//                 headers: { 'Content-Type': 'application/json' },
//                 body: JSON.stringify(payload)
//             }
//         );
//
//         const data = await res.json();
//         const rawResponse = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'ИИден ката кетти';
//
//         const adapted = adaptText(rawResponse, disability);
//         appendMessage('bot', adapted);
//
//     } catch (error) {
//         appendMessage('bot', 'Тармакта ката кетти: ' + error.message);
//     } finally {
//         sendBtn.disabled = false;
//         loadingDiv.style.display = 'none';
//         userInput.focus();
//     }
// }
//
// sendBtn.addEventListener('click', sendMessage);
// userInput.addEventListener('keydown', (e) => {
//     if (e.key === 'Enter' && !sendBtn.disabled) {
//         sendMessage();
//     }
// });
// userInput.addEventListener('input', () => {
//     sendBtn.disabled = userInput.value.trim() === '';
// });