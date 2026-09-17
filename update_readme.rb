content = File.read('README.md')

hero_img = "\n\n![ReviseCheck Dashboard](public/screenshots/hero.png)\n\n"
dash_img = "\n\n![ReviseCheck Audit Results](public/screenshots/dashboard.png)\n\n"

# Insert hero image after the intro paragraph
content.sub!(/(zero false-positive commercial diffs\.\n)/, "\\1#{hero_img}")

# Insert dashboard image after Key Capabilities
content.sub!(/(## Key Capabilities\n)/, "\\1#{dash_img}")

File.write('README.md', content)
