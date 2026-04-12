import re

with open('./code/main/data/data_query.js', 'r') as f:
    text = f.read()

text = re.sub(
    r"labels: \['PD1', 'PD2', 'PD3', 'PD4', 'PD5', 'PD6', 'PD7', 'PD8'\],",
    r"labels: Array.from({length:48}, (_, i) => 'Chan ' + (i+1)),",
    text
)

text = re.sub(
    r"labels: \['LED1', 'LED2', 'LED3', 'LED4', 'LED5', 'LED6', 'LED7', 'LED8'\],",
    r"labels: Array.from({length:48}, (_, i) => 'Chan ' + (i+1)),",
    text
)

with open('./code/main/data/data_query.js', 'w') as f:
    f.write(text)
