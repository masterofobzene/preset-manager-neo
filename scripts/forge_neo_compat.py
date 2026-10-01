"""
Forge Neo DOM selector map for critical components.

Provides explicit CSS selectors as fallback for components that cannot be 
resolved through either blocks.ui_loadsave.component_mapping or ui-config.json.

Used when both Gradio component ID and ui-config DOM query mechanisms fail.
"""

FORGE_NEO_SELECTORS = {
    # txt2img — direct paths
    "txt2img/Sampling method":    "#txt2img_sampling",
    "txt2img/Sampling Method":    "#txt2img_sampling",
    "txt2img/Sampling steps":     "#txt2img_steps",
    "txt2img/Sampling Steps":     "#txt2img_steps",
    "txt2img/Schedule type":      "#txt2img_scheduler",
    "txt2img/Schedule Type":      "#txt2img_scheduler",

    # txt2img — sampler.py aliases (what resolveComponentPath returns)
    "customscript/sampler.py/txt2img/Sampling Method": "#txt2img_sampling",
    "customscript/sampler.py/txt2img/Sampling Steps":  "#txt2img_steps",
    "customscript/sampler.py/txt2img/Schedule Type":   "#txt2img_scheduler",

    # img2img — direct paths
    "img2img/Sampling method":    "#img2img_sampling",
    "img2img/Sampling Method":    "#img2img_sampling",
    "img2img/Sampling steps":     "#img2img_steps",
    "img2img/Sampling Steps":     "#img2img_steps",
    "img2img/Schedule type":      "#img2img_scheduler",
    "img2img/Schedule Type":      "#img2img_scheduler",

    # img2img — sampler.py aliases
    "customscript/sampler.py/img2img/Sampling Method": "#img2img_sampling",
    "customscript/sampler.py/img2img/Sampling Steps":  "#img2img_steps",
    "customscript/sampler.py/img2img/Schedule Type":   "#img2img_scheduler",
    
}
