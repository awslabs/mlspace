import Quill from 'quill';
import React, { useEffect } from 'react';
import { useMemo } from 'react';
import ReactQuill from 'react-quill';
import { CallbackFunction } from '../../types';
import 'react-quill/dist/quill.snow.css';

function imageHandler (this: { quill: Quill }) {
    const curQuill = this && this.quill;
    const toolTip = curQuill.theme.tooltip;

    // save the default toolTip functions that we are overriding
    const defaultToolTipSaveFunction = toolTip.save;
    const defaultToolTipHideFunction = toolTip.hide;

    toolTip.edit('image');
    toolTip.textbox.placeholder = 'Enter image URL';
    const input = toolTip.root.querySelector('input');
    input.removeAttribute('data-formula');
    input.removeAttribute('data-link');

    // override the default save function
    toolTip.save = function () {
        this.quill.focus();
        const cursorPosition = this.quill.getSelection().index;
        const imageURL = this.textbox.value;

        if (imageURL) {
            try {
                const validURL = imageURL;
                if (validURL) {
                    this.quill.insertEmbed(cursorPosition, 'image', validURL, 'user');
                    this.quill.setSelection(cursorPosition + 1);
                }
            } catch (e) {
                console.error(e);
            }
            // clear the toolTip text after saving
            this.textbox.value = '';
        }
    };

    // restore default toolTip appearance, save, and hide to prevent side effects for the link toolTip
    toolTip.hide = () => {
        toolTip.save = defaultToolTipSaveFunction;
        toolTip.hide = defaultToolTipHideFunction;
        toolTip.hide();
    };
}

export type RichTextEditorProps = {
    value: string;
    onChange: CallbackFunction;
};

export function RichTextEditor (props: RichTextEditorProps) {
    const addTitleNodeIfNeeded = (element, title) => {
        const svg = element.querySelector('svg');
        if (svg) {
            if (!svg.querySelector('title')) {
                const titleNode = document.createElementNS('http://www.w3.org/2000/svg', 'title');
                titleNode.textContent = title;
                svg.prepend(titleNode);
            }
        }
    };

    const modules = useMemo(
        () => ({
            toolbar: {
                container: [
                    [
                        { header: 1 },
                        { header: 2 },
                        'bold',
                        'italic',
                        { color: [] },
                        'link',
                        'image',
                    ],
                ],
                handlers: {
                    image: imageHandler,
                },
            },
        }),
        []
    );

    const formats = ['header', 'bold', 'italic', 'color', 'link', 'image', 'list'];

    useEffect(() => {
        const toolbars = document.querySelectorAll('.ql-toolbar');
        toolbars.forEach((toolbar) => {
            const buttons = toolbar.getElementsByTagName('button');
            for (let i = 0; i < buttons.length; i++) {
                const button = buttons[i];
                const className = button.getAttribute('class')?.toLowerCase();
                if (className) {
                    let buttonLabel;
                    let imageLabel;

                    if (className.indexOf('bold') >= 0) {
                        buttonLabel = 'Toggle bold text';
                        imageLabel = 'Bold icon';
                    } else if (className.indexOf('italic') >= 0) {
                        buttonLabel = 'Toggle italic text';
                        imageLabel = 'Italic icon';
                    } else if (className.indexOf('header') >= 0 && button.value === '1') {
                        buttonLabel = 'Toggle heading level 1';
                        imageLabel = 'Heading level 1 icon';
                    } else if (className.indexOf('header') >= 0 && button.value === '2') {
                        buttonLabel = 'Toggle heading level 2';
                        imageLabel = 'Heading level 2 icon';
                    } else if (className.indexOf('link') >= 0) {
                        buttonLabel = 'Toggle link text';
                        imageLabel = 'Hyperlink icon';
                    } else if (className.indexOf('image') >= 0) {
                        buttonLabel = 'Insert image';
                        imageLabel = 'Image icon';
                    }

                    if (buttonLabel) {
                        button.setAttribute('aria-label', buttonLabel);
                    }
                    if (imageLabel) {
                        addTitleNodeIfNeeded(button, imageLabel);
                    }
                }
            }

            const colorPicker = toolbar.querySelector('.ql-color-picker');
            if (colorPicker) {
                const label = colorPicker.getElementsByClassName('ql-picker-label')[0];
                const optionsContainer = colorPicker.getElementsByClassName('ql-picker-options')[0];
                const options = optionsContainer.getElementsByClassName('ql-picker-item');

                label.setAttribute('role', 'button');
                label.setAttribute('aria-haspopup', 'true');
                label.setAttribute('tabIndex', '0');
                label.setAttribute('aria-label', 'Set text color');

                optionsContainer.setAttribute('aria-hidden', 'true');
                optionsContainer.setAttribute('aria-label', 'submenu');

                for (let x = 0; x < options.length; x++) {
                    const item = options[x];

                    // Read the css 'content' values and generate aria labels
                    item.setAttribute('aria-label', item['dataset'].value);
                    item.addEventListener('keyup', (e) => {
                        if (e.keyCode === 13) {
                            item.click();
                            optionsContainer.setAttribute('aria-hidden', 'true');
                        }
                    });
                }

                label.addEventListener('keyup', (e) => {
                    if (e.keyCode === 13) {
                        label.click();
                        optionsContainer.setAttribute('aria-hidden', 'false');
                    }
                });
            }
        });
    }, []);

    return (
        <ReactQuill
            modules={modules}
            formats={formats}
            value={props.value}
            onChange={props.onChange}
        />
    );
}
