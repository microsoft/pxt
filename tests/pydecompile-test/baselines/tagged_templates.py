#/ <reference path="./testBlocks/templateStrings.ts" />


template_test = template.create(img("""0123"""))


template_test2 = template.create(img("""
0


1
2
3"""))

bad_template = template.create(badt("""0123"""))