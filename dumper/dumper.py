import tkinter as tk
from tkinter import filedialog, ttk, messagebox
import argparse
import os


from rev6_2_json import BinAnim, Frame, Layer


def parse_args():
    parser = argparse.ArgumentParser(description="View RGB values in BIN sprites")
    parser.add_argument(
        "--theme",
        choices=("light", "dark"),
        default="light",
        help="Choose the application theme (default: light)",
    )
    return parser.parse_args()


def load_and_display():
    file_path = filedialog.askopenfilename(
        filetypes=[("Bin Animation", "*.bin"), ("All files", "*.*")]
    )
    if not file_path:
        return

    try:
        anim = BinAnim.from_file(file_path)
    except Exception as e:
        messagebox.showerror("Error", f"Failed to read bin file:\n{e}")
        return


    for item in tree.get_children():
        tree.delete(item)

    log_entries = []


    for animation in anim.anims:
        for layer in animation.layers:
            for frame in layer.frames:
                sprite = frame.sprite.string
                rgb = frame.rgb

                r, g, b = rgb.red, rgb.green, rgb.blue

                # ignore defaults
                if (r, g, b) in [(0, 0, 0), (255, 255, 255)]:
                    continue

                tree.insert("", "end", values=(sprite, r, g, b))
                log_entries.append(
                    f"{sprite}: R={r}, G={g}, B={b}"
                )


    if log_entries:
        log_path = os.path.join(os.path.dirname(file_path), "rgb_log.txt")
        with open(log_path, "w", encoding="utf-8") as f:
            f.write("\n".join(log_entries))

        messagebox.showinfo(
            "Log Exported",
            f"RGB log saved to:\n{log_path}"
        )
    else:
        messagebox.showinfo("No Results", "No non-default RGB values found.")



args = parse_args()
root = tk.Tk()
root.title("BIN Sprite RGB Viewer")

style = ttk.Style(root)
style.theme_use("clam")

if args.theme == "dark":
    colors = {
        "background": "#202124",
        "foreground": "#f1f3f4",
        "field": "#303134",
        "selected": "#5f6368",
    }
else:
    colors = {
        "background": "#f5f5f5",
        "foreground": "#202124",
        "field": "#ffffff",
        "selected": "#c7d7f5",
    }

root.configure(background=colors["background"])
style.configure(
    ".",
    background=colors["background"],
    foreground=colors["foreground"],
)
style.configure("Treeview", background=colors["field"], foreground=colors["foreground"])
style.map(
    "Treeview",
    background=[("selected", colors["selected"])],
    foreground=[("selected", colors["foreground"])],
)
style.configure(
    "Treeview.Heading",
    background=colors["background"],
    foreground=colors["foreground"],
)

frame = ttk.Frame(root, padding=10)
frame.pack(fill="both", expand=True)

btn = ttk.Button(frame, text="Load BIN", command=load_and_display)
btn.pack(pady=5)

tree = ttk.Treeview(frame, columns=("Sprite", "R", "G", "B"), show="headings")
tree.heading("Sprite", text="Sprite")
tree.heading("R", text="Red")
tree.heading("G", text="Green")
tree.heading("B", text="Blue")
tree.pack(fill="both", expand=True)

root.mainloop()
