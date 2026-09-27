from app.seed.bab2_variabel import CHALLENGE
from app.services import runner

BUG = 'const namaTim = "Garuda";\nconst skor = 0;\n\nskor = skor + 3;\nskor = skor + 3;\n\nconsole.log(namaTim + ": " + skor);\n'


def test_const_reassign_marks_line():
    r = runner.run(BUG, CHALLENGE["tests"])
    assert r["error"]["name"] == "TypeError" and r["error"]["line"] == 4
    assert [t["pass"] for t in r["results"]] == [True, False, False, False]
    assert r["results"][1]["detail"] == "skor harus bisa diubah"


def test_solution_passes_all():
    r = runner.run(BUG.replace("const skor", "let skor"), CHALLENGE["tests"])
    assert r["logs"] == ["Garuda: 6"] and all(t["pass"] for t in r["results"])


def test_failure_detail_uses_program_values():
    code = 'const namaTim = "Garuda";\nlet skor = 0;\nskor = skor + 3;\nconsole.log(namaTim + ": " + skor);'
    r = runner.run(code, CHALLENGE["tests"])
    assert r["results"][2]["detail"] == "skor akhir 3" and r["results"][3]["detail"] == 'output "Garuda: 3"'


def test_sandbox_blocks_escape_and_loops():
    r = runner.run('this.constructor.constructor("return process")()', [])
    assert r["error"] is not None
    r = runner.run("while (true) {}", [])
    assert r["error"]["name"] == "TimeoutError"
