(() => {

  "use strict";

 

  const OFFICIAL_CONTRACT =

    "0x76D89e26502d0aA9bf83DA222cfCF12a27Ead801";

 

  const copyButton = document.getElementById("copy");

 

  if (!copyButton) return;

 

  const originalLabel = copyButton.textContent;

 

  async function copyContract() {

    try {

      if (navigator.clipboard && window.isSecureContext) {

        await navigator.clipboard.writeText(OFFICIAL_CONTRACT);

      } else {

        const textarea = document.createElement("textarea");

        textarea.value = OFFICIAL_CONTRACT;

        textarea.setAttribute("readonly", "");

        textarea.style.position = "fixed";

        textarea.style.opacity = "0";

        document.body.appendChild(textarea);

        textarea.select();

        document.execCommand("copy");

        textarea.remove();

      }

 

      copyButton.textContent = "Copied ✓";

      copyButton.setAttribute("aria-label", "Contract address copied");

 

      window.setTimeout(() => {

        copyButton.textContent = originalLabel;

        copyButton.removeAttribute("aria-label");

      }, 1800);

    } catch (error) {

      copyButton.textContent = "Copy failed";

      window.setTimeout(() => {

        copyButton.textContent = originalLabel;

      }, 1800);

    }

  }

 

  copyButton.addEventListener("click", copyContract);

})();
