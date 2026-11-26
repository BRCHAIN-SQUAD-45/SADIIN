"""Catálogo de doenças do portal: tópicos do "Saúde de A a Z" do Ministério da Saúde + CID-10.

Fonte do conteúdo: https://www.gov.br/saude/pt-br/assuntos/saude-de-a-a-z (sintomas, prevenção,
tratamento). Fonte dos códigos: tabelas oficiais da CID-10 do DATASUS (backend/app/data/cid10/).

O "Saúde de A a Z" não informa o CID-10, então o vínculo tópico -> código foi feito à mão e é
CONFERIDO por teste (backend/tests/test_doencas.py): todo código precisa existir na tabela oficial.
Ficaram de fora os tópicos que não são doenças (vacinas, programas, SUS, SAMU, clima...) e os amplos
demais para um único código (ex.: "Doenças oculares", "Arboviroses").

Formato do código: categoria ("A90"), subcategoria ("A05.1") ou grupo oficial ("B15-B19").
Quando a OMS criou o código depois da tabela do DATASUS (2008), ele não entra aqui.
"""

from typing import NamedTuple


class TopicoAZ(NamedTuple):
    caminho: str  # parte final da URL em gov.br/saude/pt-br/assuntos/saude-de-a-a-z/
    nome: str  # nome popular, como aparece no portal do Ministério
    cid10: str
    sinonimos: tuple[str, ...] = ()


TOPICOS: tuple[TopicoAZ, ...] = (
    TopicoAZ("a/animais-peconhentos", "Acidentes por animais peçonhentos", "T63", ("picada de cobra", "escorpião", "aranha")),
    TopicoAZ("a/aids-hiv", "HIV/Aids", "B20-B24", ("aids", "hiv")),
    TopicoAZ("a/alzheimer", "Alzheimer", "G30"),
    TopicoAZ("a/arenavirus", "Arenavírus", "A96"),
    TopicoAZ("a/asma", "Asma", "J45", ("falta de ar", "chiado no peito")),
    TopicoAZ("a/aspergilose", "Aspergilose", "B44"),
    TopicoAZ("a/ame", "Atrofia muscular espinhal", "G12", ("ame",)),
    TopicoAZ("a/avc", "AVC", "I64", ("derrame", "acidente vascular cerebral")),
    TopicoAZ("b/botulismo", "Botulismo", "A05.1"),
    TopicoAZ("b/bronquiolite", "Bronquiolite", "J21"),
    TopicoAZ("b/bronquite", "Bronquite", "J40"),
    TopicoAZ("b/brucelose-humana", "Brucelose humana", "A23"),
    TopicoAZ("c/catapora-varicela", "Catapora (varicela)", "B01", ("varicela",)),
    TopicoAZ("c/caxumba", "Caxumba", "B26"),
    TopicoAZ("c/chikungunya", "Chikungunya", "A92.0"),
    TopicoAZ("c/coccidioidomicose", "Coccidioidomicose", "B38"),
    TopicoAZ("c/colera", "Cólera", "A00"),
    TopicoAZ("c/coqueluche", "Coqueluche", "A37", ("tosse comprida",)),
    TopicoAZ("c/criptococose", "Criptococose", "B45"),
    TopicoAZ("c/cromoblastomicose", "Cromoblastomicose", "B43"),
    TopicoAZ("c/cancer-de-mama", "Câncer de mama", "C50"),
    TopicoAZ("c/cancer-de-prostata", "Câncer de próstata", "C61"),
    TopicoAZ("c/cancer-de-penis", "Câncer de pênis", "C60"),
    TopicoAZ("c/cancer-de-pele", "Câncer de pele", "C43-C44"),
    TopicoAZ("c/cancer-de-boca", "Câncer de boca", "C00-C14"),
    TopicoAZ("d/dengue", "Dengue", "A90"),
    TopicoAZ("d/depressao", "Depressão", "F32"),
    TopicoAZ("d/depressao-pos-parto", "Depressão pós-parto", "F53.0"),
    TopicoAZ("d/diabetes", "Diabetes (diabetes mellitus)", "E10-E14", ("açúcar no sangue", "glicemia")),
    TopicoAZ("d/difteria", "Difteria", "A36"),
    TopicoAZ("d/dcj", "Doença de Creutzfeldt-Jakob", "A81.0", ("vaca louca",)),
    TopicoAZ("d/dda", "Doenças diarreicas agudas", "A09", ("diarreia",)),
    TopicoAZ("d/doenca-de-chagas", "Doença de Chagas", "B57", ("chagas", "barbeiro")),
    TopicoAZ("d/doenca-falciforme", "Doença falciforme", "D57", ("anemia falciforme",)),
    TopicoAZ("d/drc", "Doença renal crônica", "N18", ("insuficiência renal", "rins")),
    TopicoAZ("d/dst", "Infecções sexualmente transmissíveis (IST)", "A50-A64", ("dst", "ist")),
    TopicoAZ("e/ebola", "Ebola", "A98.4"),
    TopicoAZ("e/endometriose", "Endometriose", "N80"),
    TopicoAZ("e/epidermolise-bolhosa", "Epidermólise bolhosa", "Q81"),
    TopicoAZ("e/ela", "Esclerose lateral amiotrófica", "G12.2", ("ela",)),
    TopicoAZ("e/esporotricose-humana", "Esporotricose humana", "B42"),
    TopicoAZ("e/esquistossomose", "Esquistossomose", "B65", ("barriga d'água", "xistose")),
    TopicoAZ("e/esteatose-hepatica", "Esteatose hepática", "K76.0", ("gordura no fígado",)),
    TopicoAZ("f/febre-amarela", "Febre amarela", "A95"),
    TopicoAZ("f/febre-do-mayaro", "Febre do Mayaro", "A92.8"),
    TopicoAZ("f/febre-do-nilo-ocidental", "Febre do Nilo Ocidental", "A92.3"),
    TopicoAZ("f/febre-maculosa", "Febre maculosa", "A77", ("carrapato",)),
    TopicoAZ("f/febre-tifoide", "Febre tifoide", "A01.0"),
    TopicoAZ("f/fenilcetonuria", "Fenilcetonúria", "E70.0"),
    TopicoAZ("f/fibrose-cistica", "Fibrose cística", "E84"),
    TopicoAZ("f/elefantiase", "Filariose linfática (elefantíase)", "B74", ("elefantíase",)),
    TopicoAZ("f/fimose", "Fimose", "N47"),
    TopicoAZ("g/giardiase", "Giardíase", "A07.1"),
    TopicoAZ("g/gripe-influenza", "Gripe (influenza)", "J10-J11", ("influenza", "resfriado")),
    TopicoAZ("g/sindrome-de-guillain-barre", "Síndrome de Guillain-Barré", "G61.0"),
    TopicoAZ("h/hanseniase", "Hanseníase", "A30", ("lepra",)),
    TopicoAZ("h/hantavirose", "Hantavirose", "A98.5"),
    TopicoAZ("h/hepatites-virais", "Hepatites virais", "B15-B19", ("hepatite",)),
    TopicoAZ("h/herpes", "Herpes-zóster (cobreiro)", "B02", ("cobreiro", "herpes zoster")),
    TopicoAZ("h/hidatidose-humana", "Hidatidose humana", "B67"),
    TopicoAZ("h/hiperplasia-adrenal-congenita", "Hiperplasia adrenal congênita", "E25.0"),
    TopicoAZ("h/hipertensao", "Hipertensão (pressão alta)", "I10", ("pressão alta",)),
    TopicoAZ("h/histoplasmose", "Histoplasmose", "B39"),
    TopicoAZ("h/hpv", "HPV", "B97.7", ("verruga genital", "papilomavírus")),
    TopicoAZ("i/insolacao", "Insolação", "T67.0"),
    TopicoAZ("i/infarto", "Infarto", "I21", ("ataque cardíaco", "infarto do miocárdio")),
    TopicoAZ("l/lt", "Leishmaniose tegumentar", "B55.1"),
    TopicoAZ("l/leishmaniose-visceral", "Leishmaniose visceral", "B55.0", ("calazar",)),
    TopicoAZ("l/leptospirose", "Leptospirose", "A27"),
    TopicoAZ("l/lupus", "Lúpus", "M32"),
    TopicoAZ("m/malaria", "Malária", "B50-B54"),
    TopicoAZ("m/meningite", "Meningite", "G03"),
    TopicoAZ("m/micetomas", "Micetomas", "B47"),
    TopicoAZ("m/microcefalia", "Microcefalia", "Q02"),
    TopicoAZ("m/mpox", "Mpox", "B04", ("varíola dos macacos", "monkeypox")),
    TopicoAZ("m/mucormicose", "Mucormicose (fungo negro)", "B46", ("fungo negro",)),
    TopicoAZ("o/oncocercose", "Oncocercose", "B73"),
    TopicoAZ("o/oropouche", "Febre do Oropouche", "A93.0", ("oropouche",)),
    TopicoAZ("p/pcm", "Paracoccidioidomicose", "B41"),
    TopicoAZ("p/peste", "Peste", "A20"),
    TopicoAZ("p/poliomielite", "Poliomielite", "A80", ("paralisia infantil", "pólio")),
    TopicoAZ("r/raiva", "Raiva", "A82"),
    TopicoAZ("r/rotavirus", "Rotavírus", "A08.0"),
    TopicoAZ("r/rubeola", "Rubéola", "B06"),
    TopicoAZ("s/salmonella", "Salmonelose", "A02", ("salmonella",)),
    TopicoAZ("s/sarampo", "Sarampo", "B05"),
    TopicoAZ("s/sifilis", "Sífilis", "A51-A53"),
    TopicoAZ("s/sifilis/congenita", "Sífilis congênita", "A50"),
    TopicoAZ("s/sindrome-da-rubeola-congenita", "Síndrome da rubéola congênita", "P35.0"),
    TopicoAZ("s/sindrome-de-burnout", "Síndrome de burnout", "Z73.0", ("burnout", "esgotamento")),
    TopicoAZ("s/shu", "Síndrome hemolítico-urêmica", "D59.3"),
    TopicoAZ("t/talassemia", "Talassemia", "D56"),
    TopicoAZ("t/tetano-acidental", "Tétano acidental", "A35"),
    TopicoAZ("t/tetano-neonatal", "Tétano neonatal", "A33"),
    TopicoAZ("t/toxoplasmose", "Toxoplasmose", "B58"),
    TopicoAZ("a/autismo", "Transtorno do espectro autista", "F84", ("autismo", "tea")),
    TopicoAZ("t/trombose", "Trombose", "I80-I82"),
    TopicoAZ("t/tuberculose", "Tuberculose", "A15-A19"),
    TopicoAZ("v/vsr", "Vírus sincicial respiratório (VSR)", "B97.4", ("vsr",)),
    TopicoAZ("z/zika-virus", "Zika", "A92.8", ("zika vírus",)),
)
