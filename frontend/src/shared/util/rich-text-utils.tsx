import React, { useCallback } from 'react';
import { CallbackFunction } from '../../types';

import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Button from "@cloudscape-design/components/button";

import Document from '@tiptap/extension-document'
import TextStyle from '@tiptap/extension-text-style'
import Link from '@tiptap/extension-link'
import { Color } from '@tiptap/extension-color'
import { ColumnLayout, Container, Icon } from '@cloudscape-design/components';


export type RichTextEditorProps = {
  value: string;
  onChange: CallbackFunction;
};


export function RichTextEditor (props: RichTextEditorProps) {
  const extensions = [
    Image.configure({
        inline: true
    }),
    Color.configure({
      types: ['textStyle'],
    }),
    Document,
    TextStyle,
    StarterKit,
    Link
  ];

  const editor = useEditor({
    extensions: extensions,
    content: props.value,
  })

  const addImage = useCallback(() => {
    const url = window.prompt('URL')

    if (url) {
      editor?.chain().focus().setImage({ src: url }).run()
    }
  }, [editor])

  const setLink = useCallback(() => {
    const previousUrl = editor?.getAttributes('link').href
    const url = window.prompt('URL', previousUrl)

    // cancelled
    if (url === null) {
      return
    }

    // empty
    if (url === '') {
      editor?.chain().focus().extendMarkRange('link').unsetLink()
        .run()

      return
    }

    // update link
    editor?.chain().focus().extendMarkRange('link').setLink({ href: url })
      .run()
  }, [editor])

  if (!editor) {
    return null
  }

  editor.on('update', ({ editor }) => {
    props.onChange(editor.getHTML())
  })

  return (
    <Container>
      <ColumnLayout columns={1} borders="horizontal">
        <div>
          <Button
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            ariaLabel={'Toggle heading level 1'}
            variant='link'
          >
            <Icon variant={editor.isActive('heading', { level: 1 }) ? 'normal' : 'disabled'} svg={<svg viewBox="0 0 18 18"><title>Heading level 1 icon</title><path d="M10,4V14a1,1,0,0,1-2,0V10H3v4a1,1,0,0,1-2,0V4A1,1,0,0,1,3,4V8H8V4a1,1,0,0,1,2,0Zm6.06787,9.209H14.98975V7.59863a.54085.54085,0,0,0-.605-.60547h-.62744a1.01119,1.01119,0,0,0-.748.29688L11.645,8.56641a.5435.5435,0,0,0-.022.8584l.28613.30762a.53861.53861,0,0,0,.84717.0332l.09912-.08789a1.2137,1.2137,0,0,0,.2417-.35254h.02246s-.01123.30859-.01123.60547V13.209H12.041a.54085.54085,0,0,0-.605.60547v.43945a.54085.54085,0,0,0,.605.60547h4.02686a.54085.54085,0,0,0,.605-.60547v-.43945A.54085.54085,0,0,0,16.06787,13.209Z"></path></svg>}/>
          </Button>
          <Button
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            ariaLabel={'Toggle heading level 2'}
            variant='link'
          >
            <Icon variant={editor.isActive('heading', { level: 2 }) ? 'normal' : 'disabled'} svg={<svg viewBox="0 0 18 18"><title>Heading level 2 icon</title> <path class="ql-fill" d="M16.73975,13.81445v.43945a.54085.54085,0,0,1-.605.60547H11.855a.58392.58392,0,0,1-.64893-.60547V14.0127c0-2.90527,3.39941-3.42187,3.39941-4.55469a.77675.77675,0,0,0-.84717-.78125,1.17684,1.17684,0,0,0-.83594.38477c-.2749.26367-.561.374-.85791.13184l-.4292-.34082c-.30811-.24219-.38525-.51758-.1543-.81445a2.97155,2.97155,0,0,1,2.45361-1.17676,2.45393,2.45393,0,0,1,2.68408,2.40918c0,2.45312-3.1792,2.92676-3.27832,3.93848h2.79443A.54085.54085,0,0,1,16.73975,13.81445ZM9,3A.99974.99974,0,0,0,8,4V8H3V4A1,1,0,0,0,1,4V14a1,1,0,0,0,2,0V10H8v4a1,1,0,0,0,2,0V4A.99974.99974,0,0,0,9,3Z"></path> </svg>}/>
          </Button>
          <Button
            onClick={() => editor.chain().focus().toggleBold().run()}
            ariaLabel={'Toggle bold'}
            variant='link'
          >
            <Icon variant={editor.isActive('bold') ? 'normal' : 'disabled'} svg={<svg viewBox="0 0 18 18"><title>Bold icon</title> <path d="M5,4H9.5A2.5,2.5,0,0,1,12,6.5v0A2.5,2.5,0,0,1,9.5,9H5A0,0,0,0,1,5,9V4A0,0,0,0,1,5,4Z"></path> <path d="M5,9h5.5A2.5,2.5,0,0,1,13,11.5v0A2.5,2.5,0,0,1,10.5,14H5a0,0,0,0,1,0,0V9A0,0,0,0,1,5,9Z"></path> </svg>}/>
          </Button>
          <Button
            onClick={() => editor.chain().focus().toggleItalic().run()}
            ariaLabel={'Toggle italic'}
            variant='link'
          >
            <Icon variant={editor.isActive('italic') ? 'normal' : 'disabled'} svg={<svg viewBox="0 0 18 18"><title>Italic icon</title> <line x1="7" x2="13" y1="4" y2="4"></line> <line x1="5" x2="11" y1="14" y2="14"></line> <line x1="8" x2="10" y1="14" y2="4"></line> </svg>}/>
          </Button>
          <Button
            ariaLabel={'Set color'}
            variant='link'
            onClick={() => document.getElementById("color-picker")?.click()}
          >
            <label htmlFor="color-picker"></label>
            <input
              type="color"
              id='color-picker'
              style={{display: "none"}}
              onInput={event => editor.chain().focus().setColor(event.target.value).run()}
              value={editor.getAttributes('textStyle').color}
              data-testid="setColor"
            />
            <Icon variant="normal" svg={<svg viewBox="0 0 18 18"><title>Color icon</title><line x1="3" x2="15" y1="15" y2="15"></line> <polyline points="5.5 11 9 3 12.5 11"></polyline> <line x1="11.63" x2="6.38" y1="9" y2="9"></line> </svg>}/>
          </Button>
          <Button
            onClick={setLink}
            ariaLabel={'Toggle Link'}
            variant='link'
          >
            <Icon variant="normal" svg={<svg viewBox="0 0 18 18"><title>Hyperlink icon</title> <line x1="7" x2="11" y1="7" y2="11"></line> <path d="M8.9,4.577a3.476,3.476,0,0,1,.36,4.679A3.476,3.476,0,0,1,4.577,8.9C3.185,7.5,2.035,6.4,4.217,4.217S7.5,3.185,8.9,4.577Z"></path> <path d="M13.423,9.1a3.476,3.476,0,0,0-4.679-.36,3.476,3.476,0,0,0,.36,4.679c1.392,1.392,2.5,2.542,4.679.36S14.815,10.5,13.423,9.1Z"></path> </svg>}/>
          </Button>
          <Button
            onClick={addImage}
            ariaLabel={'Add Image'}
            variant='link'
          >
            <Icon variant="normal" svg={<svg viewBox="0 0 18 18"><title>Image icon</title> <rect height="10" width="12" x="3" y="4"></rect> <circle cx="6" cy="7" r="1"></circle> <polyline points="5 12 5 11 7 9 8 10 11 7 13 9 13 12 5 12"></polyline> </svg>}/>
          </Button>
        </div>
        <EditorContent editor={editor} />
      </ColumnLayout>
    </Container>
  )
}
