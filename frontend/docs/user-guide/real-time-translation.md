---
outline: deep
---

# Real-time Translation

::: info
Translate features are not available in the us-isob region
:::

Users can perform real-time translation on both text phrases as well as documents of the currently available file types.
Real-time translation is available to all users and is not associated with projects. Text translations are not retained
in {{ $params.APPLICATION_NAME }}. Translated documents will be downloaded upon translation for further use by the user.

Auto-detection is an option for the source language for both text and document translation and is useful if the
source language is unknown. If automatic detection of the source language is not working, please make sure that
{{ $params.APPLICATION_NAME }} has the proper IAM permissions for `comprehend:DetectDominantLanguage`.

## Text Translation

Translate provided text to a target language using either a designated source language or an auto-detected source
language. A new translation is performed whenever settings are updated or with a half-second delay when
typing into the "Enter text" field.

## Document Translation

Translate a single uploaded document. The document must be one of the supported file types
(.txt, .html, and .docx). After the user submits the document for translation and the request completes, the
resulting document is downloaded automatically. The name of the translated document will be the original filename
with the TargetLanguageCode added as a prefix. For example, 'translate.txt'
translated into Spanish would be translated and then downloaded onto the user's machine as 'es.translate.txt'.

## Additional Settings

Users have additional settings they can use to customize their translation.

 - **Custom Terminology**
	    - This can be used to explicitly map certain terminologies from certain languages to target languages. Custom terminologies can be added by system administrators and then will be available for all users. To better understand how to utilize Custom Terminologies, please check [AWS Translate's documentation](https://docs.aws.amazon.com/translate/latest/dg/using-ct.html).
- **Formality**
	    - For certain languages formality can be modified to translate the output into formal or informal phrasing. For an updated list of languages that support formality please check [AWS Translate's documentation](https://docs.aws.amazon.com/translate/latest/dg/customizing-translations-formality.html#customizing-translations-formality-languages).
- **Profanity Masking**
	    - This can be used to mask profane words with an alternative of `?$#@$`. Profanity masking is not available for all languages. For an updated list of languages that support profanity masking please check [AWS Translate's documentation](https://docs.aws.amazon.com/translate/latest/dg/customizing-translations-profanity.html#customizing-translations-profanity-languages).
