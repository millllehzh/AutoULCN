// Cross-browser compatibility
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

// === Detect and save secret key (as you already had) ===
const detectAndSaveSecretKey = () => {
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.target.classList.contains('display') && mutation.target.innerText !== '••••••••••••••••') {
                const secretKey = mutation.target.innerText.trim();
                browserAPI.storage.local.set({ Secret_Key: secretKey }, () => {
                    showSecretKeyNotification(secretKey);
                });
                observer.disconnect();
            }
        });
    });

    const spanElement = document.querySelector('[data-hidden-value] > .display');
    if (spanElement) {
        observer.observe(spanElement, { childList: true });
    }
};

// === Notification ===
const showSecretKeyNotification = (secretKey) => {
    const notificationDiv = document.createElement('div');
    notificationDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 16px 20px;
        background: linear-gradient(135deg, #10b981, #059669);
        color: white;
        z-index: 99999;
        border-radius: 12px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 14px;
        font-weight: 500;
        box-shadow: 0 10px 25px rgba(16, 185, 129, 0.3);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        transform: translateX(400px);
        transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        max-width: 300px;
        word-wrap: break-word;
    `;

    const icon = document.createElement('span');
    icon.style.cssText = `
        display: inline-block;
        margin-right: 8px;
        font-size: 16px;
    `;
    icon.textContent = '🔐';

    const message = document.createElement('span');
    message.innerHTML = `<strong>Secret Key Detected!</strong><br><small style="opacity: 0.9;">${secretKey.substring(0, 8)}...</small>`;

    notificationDiv.appendChild(icon);
    notificationDiv.appendChild(message);
    document.body.appendChild(notificationDiv);

    // Animate in
    requestAnimationFrame(() => {
        notificationDiv.style.transform = 'translateX(0)';
    });

    // Animate out
    setTimeout(() => {
        notificationDiv.style.transform = 'translateX(400px)';
        notificationDiv.style.opacity = '0';
        setTimeout(() => {
            if (notificationDiv.parentNode) {
                notificationDiv.remove();
            }
        }, 400);
    }, 4000);
};

// === TOTP Generation ===
function generateTOTP(secret) {
    // Base32 decode
    function base32tohex(base32) {
        const base32chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
        let bits = "";
        let hex = "";
        for (let i = 0; i < base32.length; i++) {
            const val = base32chars.indexOf(base32.charAt(i).toUpperCase());
            if (val >= 0) bits += val.toString(2).padStart(5, "0");
        }
        for (let i = 0; i + 4 <= bits.length; i += 4) {
            hex += parseInt(bits.substr(i, 4), 2).toString(16);
        }
        return hex;
    }

    const epoch = Math.round(new Date().getTime() / 1000.0);
    const time = Math.floor(epoch / 30).toString(16).padStart(16, "0");

    const shaObj = new jsSHA("SHA-1", "HEX");
    shaObj.setHMACKey(base32tohex(secret), "HEX");
    shaObj.update(time);
    const hmac = shaObj.getHMAC("HEX");

    const offset = parseInt(hmac.substring(hmac.length - 1), 16);
    const otp = (parseInt(hmac.substr(offset * 2, 8), 16) & 0x7fffffff) + "";
    return otp.substr(otp.length - 6, 6);
}

// === Auto-generate and send TOTP to content.js ===
function sendTOTP() {
    browserAPI.storage.local.get("Secret_Key", (data) => {
        if (data.Secret_Key) {
            const totp = generateTOTP(data.Secret_Key);

            // Send to the current active tab
            browserAPI.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0]) {
                    browserAPI.tabs.sendMessage(tabs[0].id, {
                        type: "TOTP_CODE",
                        code: totp
                    });
                }
            });
        }
    });
}

// === Init ===
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    detectAndSaveSecretKey();
} else {
    document.addEventListener('DOMContentLoaded', detectAndSaveSecretKey);
}

// Generate + send a TOTP every 30s
setInterval(sendTOTP, 1000); // check every second (updates when new 30s window starts)
