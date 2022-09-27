# MakeCode Translation Tips and Tricks

**Posted on September 19th, 2022 by [anzhou5](https://github.com/anzhou5)**

## A quick guide to translating the MakeCode editor

MakeCode is used by students across the world, and we are so excited and appreciative every time we are able to release a new language and support a new community of learners!  Language translation for MakeCode is possible thanks to an amazing community of volunteer translators! If you would like to get involved or want to learn more about translating MakeCode, please visit our [Help Translate](https://makecode.com/translate) page.

We use [Crowdin](https://crowdin.com/project/makecode) as our main translation platform. Here are a few tips and tricks that can help you get started:

### Tip #1: Getting a language published
While we offer many languages as options for translation on Crowdin, not all the languages appear on our MakeCode websites (for micro:bit, Arcade, etc.). This is because we require some level of translation to be completed before we enable a language on our site. This typically means at least 85% translation completion of our key files that comprise 3 key parts of each language:

1)	User interface strings on the editor websites:

![User interface strings](/static/blog/microbit/localization/user-interface-strings.png)

2)	The core MakeCode blocks which are common across all editors (i.e. Math, Loops, Logic blocks)

![Core blocks](/static/blog/microbit/localization/core-blocks.png)

3)	Additional blocks specific to the editor (i.e. Radio and LED blocks in the micro:bit editor)

![Specialized blocks](/static/blog/microbit/localization/specialized-blocks.png)

### Tip #2: Tasks

For each of the 3 parts of the editor to translate, there are different files in Crowdin with the text to translate.  To make it easier for you to know which files to translate, we have created tasks that specify which file corresponds to what part of the MakeCode editor.  Once you have achieved the translation goal and have it all confirmed by a proofreader, you can message our Crowdin account and we will do a final review and schedule a release.

Here is a sample task for translating MakeCode Arcade to Arabic: https://crowdin.com/project/makecode/tasks/922.

### Tip #3: In-context translations

Another approach to translating the files directly in Crowdin is to use [in-context translations](https://makecode.com/translate/in-context). This allows you to work directly in the MakeCode interface and click on the things you want to translate. Any translations you put into the in-context translation tool will be updated in the Crowdin project. We do want to note that this tool is relatively new and you may encounter some bugs.  We encourage you to refresh the page a few times if you experience any issues and provide us with feedback.

![In-context translations](/static/blog/microbit/localization/in-context-translations.png)

For people interested in translating MakeCode for the micro:bit, please watch this [video](https://www.youtube.com/watch?v=eQldcOs-1_4) from Micro:bit Live about how to get involved with the micro:bit translation community.

## Translator shout-outs!

Our translating community is full of incredible individuals who donate their time and effort to the cause of globalizing the MakeCode editor. We wanted to take some time to thank some specific members on our Crowdin community who have gone above and beyond so far in 2022:

- **syslo** has been translating Polish with over 55,000 contributions this year
- **AntoniOlivella** has been translating Catalan with over 41,000 contributions this year
- **CephasPi** has been translating Slovak with over 34,000 contributions this year
- **yeremiaryangunadi** has been translating Indonesian with over 33,000 contributions this year
- **uranlena2** has been translating Albanian with over 25,000 contributions this year
- **goox** has been translating French with over 16,000 contributions this year
- **Ski26** has been translating Tagalog with over 15,000 contributions this year
- **rozsahegyip** has been translating Hungarian with over 10,000 contributions this year

The above translators/proofreaders are not solely defined by the numbers provided. Many of our translators, including the above folks, are long-standing contributors who have helped us maintain content in multiple languages as we develop our content. We are so thankful for what they and the others in our community do.

Additionally, we want to give a special additional shout-out to **rogerst**, who was the catalyst behind the effort to get Catalan translated for our micro:bit editor. In his work to get this done, he recruited, trained, and supported volunteers whilst proofreading translations himself. His commitment to bring the translated version of the editor and microbit.org to students in his region is truly paying off, as Catalan was recently released as a language on our MakeCode micro:bit beta site!