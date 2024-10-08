interface Style {
    "--background": string;
    "--foreground": string;
    "--primary": string;
    "--secondary": string;
    "--accent": string;
    "--highlight": string;
    "--error": string;
    "--success": string;
    "--warning": string;
    "--info": string;
    "--border": string;
    "--muted": string;
}

const tokyo_night_style: Style = {
    "--background": "#1a1b26",
    "--foreground": "#c0caf5",
    "--primary": "#7aa2f7",
    "--secondary": "#bb9af7",
    "--accent": "#7dcfff",
    "--highlight": "#ff9e64",
    "--error": "#f7768e",
    "--success": "#9ece6a",
    "--warning": "#e0af68",
    "--info": "#2ac3de",
    "--border": "#3b4261",
    "--muted": "#565f89",
};

const catppuccin_style: Style = {
    "--background": "#1e1e2e",
    "--foreground": "#d9e0ee",
    "--primary": "#96cdfb",
    "--secondary": "#f5c2e7",
    "--accent": "#8bd5ca",
    "--highlight": "#f28fad",
    "--error": "#f28fad",
    "--success": "#a6e3a1",
    "--warning": "#f8bd96",
    "--info": "#89dceb",
    "--border": "#585b70",
    "--muted": "#6e6c7e",
};

const rose_pine: Style = {
    "--background": "#191724",
    "--foreground": "#e0def4",
    "--primary": "#eb6f92",
    "--secondary": "#f6c177",
    "--accent": "#9ccfd8",
    "--highlight": "#c4a7e7",
    "--error": "#eb6f92",
    "--success": "#31748f",
    "--warning": "#f6c177",
    "--info": "#9ccfd8",
    "--border": "#6e6a86",
    "--muted": "#908caa",
};

class SetStyle {
    container;

    // For selecting the theme
    // @ts-ignore
    theme_select: HTMLSelectElement = document.createElement("Select");
    theme_type = "tokyo-night";

    _options: { [key: string]: Style } = {
        "tokyo-night": tokyo_night_style,
        catppuccin: catppuccin_style,
        "rose-pine": rose_pine,
    };

    constructor() {
        this.container = document.getElementById("container");

        Object.keys(this._options).forEach((option) => {
            if (option == this.theme_type) {
                this.theme_select.add(new Option(option, option, true, true));
            } else {
                this.theme_select.add(new Option(option, option));
            }
        });

        this.theme_select.addEventListener("change", () => {
            let style: Style = this._options[this.theme_select.value];
            Object.keys(style).forEach((opt) => {
                document.documentElement.style.setProperty(opt, style[opt]);
            });
        });

        this.container.appendChild(this.theme_select);
    }
}

let set_style = new SetStyle();
