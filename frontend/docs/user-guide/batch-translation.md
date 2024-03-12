---
outline: deep
---

# Batch Translation

::: info
Translate features are not available in the us-isob region
:::

Users can perform asynchronous translation on large collections of documents (up to 5 GB in size) by using the batch translation service. Users can navigate to the batch translation page within a project.

The batch translation page will list completed and in-progress translation jobs as well as allow users to take various actions against those jobs, including creating new translation jobs, viewing details for existing translation jobs, and stopping running translation jobs.

A user will be able to view *all* batch translation jobs associated with a given project from the batch translation landing page, however the output of any given batch translation job may be in a dataset not visible to the user.

## Create a Batch Translation Job

Before starting a batch translation job, a user should create an input and output dataset.
- the input dataset should contain all of the files the user wants to be translated. These files should all share the same language.
- the output dataset will be used when creating a batch translation job as the place for the translated documents to be uploaded to.

From the batch translation dashboard, users can create new batch translation jobs by selecting a single source language, selecting one or more target languages, choosing a source dataset location with the files they wish to translate, the content type of those files (plain text, HTML text, document like docx, etc), and choosing an output dataset location.

There are some optional fields that may be utilized and are explained in the [Additional Settings](#additional-settings) section below. Amazon Translate, on the backend, provisions the resources required for translation, and simply lets the user know when the asynchronous batch translation job is done!

### Additional Settings
Users have additional settings they can use to customize their translation.

- **Custom Terminology** - This can be used to explicitly map certain terminologies from certain languages to target languages. Custom terminologies can be added by system administrators and then will be available for all users. To better understand how to utilize Custom Terminologies, please check [AWS Translate's documentation](https://docs.aws.amazon.com/translate/latest/dg/using-ct.html).
- **Formality** - For certain languages formality can be modified to translate the output into formal or informal phrasing. For an updated list of languages that support formality please check [AWS Translate's documentation](https://docs.aws.amazon.com/translate/latest/dg/customizing-translations-formality.html#customizing-translations-formality-languages).
- **Profanity Masking** - This can be used to mask profane words with an alternative of `?$#@$`. Profanity masking is not available for all languages. For an updated list of languages that support profanity masking please check [AWS Translate's documentation](https://docs.aws.amazon.com/translate/latest/dg/customizing-translations-profanity.html#customizing-translations-profanity-languages).

### Batch Translate Job constraints
- if an input dataset has files of varying types (.txt, .docx, etc), batch translate will only translate the documents of the content type selected during job creation.
- if a single document contains multiple languages, batch translate will only translate the parts containing the selected source language into the selected target language(s).
- if an input dataset has files of varying languages, only the files of the selected source language will be translated into the target language(s).
- if `auto` is selected as the source language, batch translate will sample the first 1,000 characters in each file and detect the dominant language as the source language and translate each file to the specified target language(s).

::: info
`auto` source language detection for batch translate is not currently available in ADC regions.
:::

## Batch Translation Job details
The details view for batch translation jobs allows a user to review the settings used to create the translation job including the input dataset location, output dataset location, source language, target language(s), the number of documents successfully translated, the job status, and the optional settings such as custom terminologies used, formality, and profanity masking.

Users can also stop an In-Progress job from its details page.

