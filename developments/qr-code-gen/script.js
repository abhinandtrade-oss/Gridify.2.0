const qrCode = new QRCodeStyling({
    width: 300,
    height: 300,
    type: "svg",
    data: "https://gridify.in",
    image: "",
    dotsOptions: {
        color: "#3b82f6",
        type: "rounded"
    },
    backgroundOptions: {
        color: "#ffffff",
    },
    imageOptions: {
        crossOrigin: "anonymous",
        margin: 10
    }
});

// Initial Render
qrCode.append(document.getElementById("canvas"));

// Inputs
const urlInput = document.getElementById("url-input");
const colorInput = document.getElementById("color-input");
const bgColorInput = document.getElementById("bg-color-input");
const transparentBgInput = document.getElementById("transparent-bg");
const styleInput = document.getElementById("dots-style");
const logoInput = document.getElementById("logo-input");
const generateBtn = document.getElementById("generate-btn");
const downloadBtn = document.getElementById("download-btn");
const fileLabel = document.querySelector(".file-upload-btn span");
const removeLogoBtn = document.getElementById("remove-logo-btn");

let currentLogo = "";

// Handle Logo Upload
logoInput.addEventListener("change", function (e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function () {
            currentLogo = reader.result;
            fileLabel.textContent = file.name;
            removeLogoBtn.style.display = "flex";
            // Live update
            qrCode.update({
                image: currentLogo
            });
        }
        reader.readAsDataURL(file);
    }
});

// Remove Logo
removeLogoBtn.addEventListener("click", () => {
    currentLogo = "";
    fileLabel.textContent = "Choose Image";
    logoInput.value = ""; // Clear file input
    removeLogoBtn.style.display = "none";

    // Live update
    qrCode.update({
        image: ""
    });
});

function getBackgroundOptions() {
    if (transparentBgInput.checked) {
        bgColorInput.style.opacity = "0.5";
        bgColorInput.disabled = true;
        return { color: "transparent" };
    } else {
        bgColorInput.style.opacity = "1";
        bgColorInput.disabled = false;
        return { color: bgColorInput.value };
    }
}

// Update QR Code
generateBtn.addEventListener("click", () => {
    const url = urlInput.value || "https://gridify.in";
    const color = colorInput.value;
    const style = styleInput.value;

    qrCode.update({
        data: url,
        image: currentLogo,
        dotsOptions: {
            color: color,
            type: style
        },
        backgroundOptions: getBackgroundOptions()
    });
});

// Live update for simple changes
colorInput.addEventListener("input", () => {
    qrCode.update({
        dotsOptions: {
            color: colorInput.value
        }
    });
});

bgColorInput.addEventListener("input", () => {
    if (!transparentBgInput.checked) {
        qrCode.update({
            backgroundOptions: {
                color: bgColorInput.value
            }
        });
    }
});

transparentBgInput.addEventListener("change", () => {
    qrCode.update({
        backgroundOptions: getBackgroundOptions()
    });
});

styleInput.addEventListener("change", () => {
    qrCode.update({
        dotsOptions: {
            type: styleInput.value
        }
    });
});

// Download
downloadBtn.addEventListener("click", () => {
    qrCode.download({ name: "qr-code", extension: "png" });
});
