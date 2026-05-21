"""Generate Varshini's internship .docx report for the Toyota Meeting Room Booking
and Employee Management System project carried out at Nichi-In Software Solutions.

Run:
    python scripts/generate_report.py

Output:
    Varshini_Internship_Report.docx (at project root)
"""

from docx import Document
from docx.shared import Pt, Inches, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.enum.table import WD_ALIGN_VERTICAL
from docx.oxml.ns import qn
from docx.oxml import OxmlElement


# ---------- Static identity / project context -----------------------------
STUDENT_NAME = "Varshini M"
USN = "1AJ22CS178"
BRANCH_FULL = "Computer Science and Engineering"
BRANCH_SHORT = "CSE"
COLLEGE = "Cambridge Institute of Technology North Campus"
COLLEGE_SHORT = "CITNC"
COLLEGE_ADDRESS = "Kundana, Bengaluru-562110, Karnataka"
ACADEMIC_YEAR = "2025-2026"

INTERNSHIP_TITLE = "JAVA FULL STACK DEVELOPMENT"
INTERNSHIP_TITLE_TITLECASE = "Java Full Stack Development"

COMPANY = "Nichi-In Software Solutions Pvt. Ltd."
COMPANY_ADDRESS = ("No. 813, Dr. Puneeth Rajkumar Road, Hosakerehalli, "
                   "Banashankari 3rd Stage, Bengaluru – 560 085, India")
COMPANY_WEB = "www.nichi.com"
INTERNSHIP_FROM = "January 22, 2026"
INTERNSHIP_TO = "May 9, 2026"

EXTERNAL_GUIDE_NAME = "Mr. Raveendra R E"
EXTERNAL_GUIDE_DESIG = "Delivery Manager"

INTERNAL_GUIDE_NAME = "_______________________"
INTERNAL_GUIDE_DESIG = "Assistant Professor, Dept. of CSE, CITNC"

COORDINATOR_NAME = "Prof. Vijaya Kumara Y"
COORDINATOR_DESIG = "Assistant Professor, Dept. of CSE, CITNC"

HOD_NAME = "Dr. Rajshekhar M Patil"
HOD_DESIG = "Professor & HoD, Dept. of CSE, CITNC"

PRINCIPAL_NAME = "Dr. Prasad Naik Hamsavath"
PRINCIPAL_DESIG = "Principal, CITNC, Kundana, Bengaluru"

PROJECT_NAME = "Toyota Meeting Room Booking and Employee Management System"
PROJECT_SHORT = "Meeting Room Booking & EMS"

HEADER_LEFT = f"{INTERNSHIP_TITLE_TITLECASE} – {PROJECT_SHORT}"
HEADER_RIGHT = "Nichi-In Software Solutions Pvt. Ltd."
FOOTER_LEFT = f"Dept. of {BRANCH_SHORT}, {COLLEGE_SHORT}"
FOOTER_RIGHT = ACADEMIC_YEAR


# ---------- Low level helpers --------------------------------------------
def set_run_font(run, name="Times New Roman", size=12, bold=False,
                 italic=False, color=None):
    run.font.name = name
    run.font.size = Pt(size)
    run.bold = bold
    run.italic = italic
    if color is not None:
        run.font.color.rgb = RGBColor(*color)
    # Ensure East Asian font is also set (Word quirk)
    rPr = run._element.get_or_add_rPr()
    rFonts = rPr.find(qn("w:rFonts"))
    if rFonts is None:
        rFonts = OxmlElement("w:rFonts")
        rPr.append(rFonts)
    rFonts.set(qn("w:eastAsia"), name)


def add_para(doc, text, size=12, bold=False, italic=False,
             align=None, color=None, space_after=6, space_before=0,
             first_line_indent=None):
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(space_after)
    p.paragraph_format.space_before = Pt(space_before)
    if align is not None:
        p.alignment = align
    if first_line_indent is not None:
        p.paragraph_format.first_line_indent = first_line_indent
    run = p.add_run(text)
    set_run_font(run, size=size, bold=bold, italic=italic, color=color)
    return p


def add_runs(doc, parts, align=None, space_after=6, space_before=0):
    """parts: list of (text, dict-of-formatting-overrides)"""
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(space_after)
    p.paragraph_format.space_before = Pt(space_before)
    if align is not None:
        p.alignment = align
    for text, fmt in parts:
        r = p.add_run(text)
        set_run_font(
            r,
            size=fmt.get("size", 12),
            bold=fmt.get("bold", False),
            italic=fmt.get("italic", False),
            color=fmt.get("color"),
        )
    return p


def add_blank(doc, n=1):
    for _ in range(n):
        add_para(doc, "", space_after=0)


def add_page_break(doc):
    p = doc.add_paragraph()
    p.add_run().add_break(WD_BREAK.PAGE)


def add_heading_chapter(doc, chapter_num, chapter_name):
    add_para(doc, f"CHAPTER – {chapter_num}", size=18, bold=True,
             align=WD_ALIGN_PARAGRAPH.CENTER, space_before=12, space_after=6)
    add_para(doc, chapter_name, size=18, bold=True,
             align=WD_ALIGN_PARAGRAPH.CENTER, space_after=18)


def add_heading_section(doc, text, size=14):
    add_para(doc, text, size=size, bold=True,
             space_before=10, space_after=6)


def add_bullets(doc, items, indent=0.25):
    for it in items:
        p = doc.add_paragraph(style="List Bullet")
        p.paragraph_format.left_indent = Inches(indent)
        p.paragraph_format.space_after = Pt(3)
        run = p.add_run(it)
        set_run_font(run, size=12)


def add_numbered(doc, items):
    for it in items:
        p = doc.add_paragraph(style="List Number")
        p.paragraph_format.space_after = Pt(3)
        run = p.add_run(it)
        set_run_font(run, size=12)


def add_body(doc, text, justify=True, first_line_indent=0.3):
    align = WD_ALIGN_PARAGRAPH.JUSTIFY if justify else None
    add_para(
        doc, text, size=12, align=align, space_after=8,
        first_line_indent=Inches(first_line_indent) if first_line_indent else None,
    )


def add_table_caption(doc, label, caption):
    """Add a centred bold caption above a table (e.g. 'Table 1.1: ...')."""
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(6)
    p.paragraph_format.space_after = Pt(4)
    r1 = p.add_run(f"{label}: ")
    set_run_font(r1, size=11, bold=True, italic=True)
    r2 = p.add_run(caption)
    set_run_font(r2, size=11, italic=True)


def add_table_two_col(doc, rows, col1_width=2.0, col2_width=4.5,
                      header_row=None, table_label=None, caption=None):
    if table_label and caption:
        add_table_caption(doc, table_label, caption)
    tbl = doc.add_table(rows=0, cols=2)
    tbl.style = "Light Grid Accent 1"
    tbl.autofit = False
    if header_row:
        row = tbl.add_row().cells
        row[0].text = ""
        row[1].text = ""
        for i, t in enumerate(header_row):
            row[i].text = ""
            for p in row[i].paragraphs:
                p._p.getparent().remove(p._p)
            p = row[i].add_paragraph()
            r = p.add_run(t)
            set_run_font(r, size=12, bold=True)
    for r1, r2 in rows:
        row = tbl.add_row().cells
        for cell, txt in zip(row, (r1, r2)):
            for p in cell.paragraphs:
                p._p.getparent().remove(p._p)
            p = cell.add_paragraph()
            run = p.add_run(txt)
            set_run_font(run, size=12)
    # Set column widths
    for row in tbl.rows:
        row.cells[0].width = Inches(col1_width)
        row.cells[1].width = Inches(col2_width)
    add_blank(doc, 1)
    return tbl


def add_screenshot(doc, image_path, fig_label, caption, width_inches=6.0):
    """Embed an actual screenshot image with a caption underneath."""
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(6)
    p.paragraph_format.space_after = Pt(4)
    run = p.add_run()
    run.add_picture(image_path, width=Inches(width_inches))
    # Caption below
    cp = doc.add_paragraph()
    cp.alignment = WD_ALIGN_PARAGRAPH.CENTER
    cp.paragraph_format.space_before = Pt(2)
    cp.paragraph_format.space_after = Pt(14)
    r = cp.add_run(f"{fig_label}: {caption}")
    set_run_font(r, size=11, bold=True, italic=True)


def add_page_border(doc, sz="18", space="24", color="000000"):
    """Add a single-line border around every page in the section.

    sz: border thickness in eighths of a point (18 = 2.25pt)
    space: distance from page edge (in points)
    """
    section = doc.sections[0]
    sectPr = section._sectPr
    # Remove any existing pgBorders
    for existing in sectPr.findall(qn("w:pgBorders")):
        sectPr.remove(existing)
    pgBorders = OxmlElement("w:pgBorders")
    pgBorders.set(qn("w:offsetFrom"), "page")
    for edge in ("top", "left", "bottom", "right"):
        b = OxmlElement(f"w:{edge}")
        b.set(qn("w:val"), "single")
        b.set(qn("w:sz"), sz)
        b.set(qn("w:space"), space)
        b.set(qn("w:color"), color)
        pgBorders.append(b)
    sectPr.append(pgBorders)


def set_cell_text(cell, text, bold=False, size=12, align=None):
    for p in cell.paragraphs:
        p._p.getparent().remove(p._p)
    p = cell.add_paragraph()
    if align is not None:
        p.alignment = align
    r = p.add_run(text)
    set_run_font(r, size=size, bold=bold)
    cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER


def add_page_number_field(paragraph):
    """Insert a PAGE field code into a paragraph (used in footer)."""
    run = paragraph.add_run()
    fldChar1 = OxmlElement("w:fldChar")
    fldChar1.set(qn("w:fldCharType"), "begin")
    instrText = OxmlElement("w:instrText")
    instrText.set(qn("xml:space"), "preserve")
    instrText.text = "PAGE"
    fldChar2 = OxmlElement("w:fldChar")
    fldChar2.set(qn("w:fldCharType"), "end")
    run._r.append(fldChar1)
    run._r.append(instrText)
    run._r.append(fldChar2)
    set_run_font(run, size=10)


def configure_header_footer(doc):
    section = doc.sections[0]
    section.different_first_page_header_footer = False
    # Header — two-column-ish using tabs
    header = section.header
    for p in header.paragraphs:
        p._p.getparent().remove(p._p)
    hp = header.add_paragraph()
    hp.paragraph_format.tab_stops.add_tab_stop(Inches(6.5),
                                               WD_ALIGN_PARAGRAPH.RIGHT)
    r1 = hp.add_run(HEADER_LEFT)
    set_run_font(r1, size=10, bold=True)
    r2 = hp.add_run("\t" + HEADER_RIGHT)
    set_run_font(r2, size=10, bold=True)
    # Bottom border on header
    pPr = hp._p.get_or_add_pPr()
    pBdr = OxmlElement("w:pBdr")
    bottom = OxmlElement("w:bottom")
    bottom.set(qn("w:val"), "single")
    bottom.set(qn("w:sz"), "6")
    bottom.set(qn("w:space"), "1")
    bottom.set(qn("w:color"), "000000")
    pBdr.append(bottom)
    pPr.append(pBdr)

    # Footer
    footer = section.footer
    for p in footer.paragraphs:
        p._p.getparent().remove(p._p)
    fp = footer.add_paragraph()
    fp.paragraph_format.tab_stops.add_tab_stop(Inches(3.25),
                                               WD_ALIGN_PARAGRAPH.CENTER)
    fp.paragraph_format.tab_stops.add_tab_stop(Inches(6.5),
                                               WD_ALIGN_PARAGRAPH.RIGHT)
    r1 = fp.add_run(FOOTER_LEFT)
    set_run_font(r1, size=10)
    r2 = fp.add_run("\t")
    add_page_number_field(fp)
    r3 = fp.add_run("\t" + FOOTER_RIGHT)
    set_run_font(r3, size=10)
    # Top border on footer
    pPr = fp._p.get_or_add_pPr()
    pBdr = OxmlElement("w:pBdr")
    top = OxmlElement("w:top")
    top.set(qn("w:val"), "single")
    top.set(qn("w:sz"), "6")
    top.set(qn("w:space"), "1")
    top.set(qn("w:color"), "000000")
    pBdr.append(top)
    pPr.append(pBdr)


# ---------- Page builders -------------------------------------------------
def build_cover_page(doc):
    add_para(doc, "VISVESVARAYA TECHNOLOGICAL UNIVERSITY",
             size=18, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER,
             color=(0x00, 0x00, 0x80), space_after=2)
    add_para(doc, "\"Jnana Sangama\", Belgavi-590 018, Karnataka, India",
             size=11, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=20)

    add_para(doc, "An Internship Report",
             size=14, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=2)
    add_para(doc, "On",
             size=14, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=2)
    add_para(doc, INTERNSHIP_TITLE,
             size=18, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER,
             color=(0x4B, 0x00, 0x82), space_after=8)
    add_para(doc,
             "Submitted in Partial Fulfillment of the requirement for the "
             "award of the degree of",
             size=11, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=10)

    add_para(doc, "BACHELOR OF ENGINEERING",
             size=14, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER,
             space_after=2)
    add_para(doc, "IN", size=12, align=WD_ALIGN_PARAGRAPH.CENTER,
             space_after=2)
    add_para(doc, BRANCH_FULL.upper(),
             size=14, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER,
             space_after=18)

    add_para(doc, "Submitted By",
             size=12, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER,
             space_after=8)
    add_runs(doc, [
        (f"{STUDENT_NAME}      ", {"size": 16, "bold": True}),
        (USN, {"size": 16, "bold": True}),
    ], align=WD_ALIGN_PARAGRAPH.CENTER, space_after=20)

    add_para(doc, "Carried out at",
             size=12, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER,
             space_after=4)
    add_para(doc, COMPANY,
             size=16, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER,
             space_after=24)

    add_para(doc, "Under the guidance of",
             size=12, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=10)

    # Two-column guide table
    tbl = doc.add_table(rows=4, cols=2)
    tbl.autofit = False
    headers = ["Internal Guide", "External Guide"]
    bodies = [
        (INTERNAL_GUIDE_NAME, EXTERNAL_GUIDE_NAME),
        (INTERNAL_GUIDE_DESIG.split(",")[0].strip(),
         EXTERNAL_GUIDE_DESIG),
        (", ".join(INTERNAL_GUIDE_DESIG.split(",")[1:]).strip(), COMPANY),
    ]
    for i, h in enumerate(headers):
        set_cell_text(tbl.rows[0].cells[i], h, bold=True,
                      align=WD_ALIGN_PARAGRAPH.CENTER)
    for ridx, (a, b) in enumerate(bodies, start=1):
        set_cell_text(tbl.rows[ridx].cells[0], a, bold=True,
                      align=WD_ALIGN_PARAGRAPH.CENTER)
        set_cell_text(tbl.rows[ridx].cells[1], b, bold=True,
                      align=WD_ALIGN_PARAGRAPH.CENTER)
    for row in tbl.rows:
        row.cells[0].width = Inches(3.25)
        row.cells[1].width = Inches(3.25)

    add_blank(doc, 2)
    add_para(doc, COLLEGE.upper(),
             size=13, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER,
             space_after=2)
    add_para(doc, f"DEPARTMENT OF {BRANCH_FULL.upper()}",
             size=12, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER,
             space_after=2)
    add_para(doc, COLLEGE_ADDRESS.upper(),
             size=11, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=2)
    add_para(doc, ACADEMIC_YEAR,
             size=12, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER)
    add_page_break(doc)


def build_certificate_page(doc):
    add_para(doc, COLLEGE.upper(),
             size=13, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER,
             space_after=2)
    add_para(doc, COLLEGE_ADDRESS.upper(),
             size=11, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=2)
    add_para(doc, f"Department of {BRANCH_FULL}",
             size=12, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER,
             space_after=18)

    add_para(doc, "CERTIFICATE",
             size=18, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER,
             color=(0xC0, 0x00, 0x00), space_after=18)

    cert_text = (
        f"This is to certify that the Internship work entitled "
        f"“{INTERNSHIP_TITLE_TITLECASE} – {PROJECT_NAME}” "
        f"carried out by {STUDENT_NAME} bearing USN: {USN}, a bonafide "
        f"student of {COLLEGE} in partial fulfillment for the award of "
        f"Bachelor of Engineering in {BRANCH_FULL} of Visvesvaraya "
        f"Technological University, Belagavi during the year "
        f"{ACADEMIC_YEAR}. It is certified that all corrections / "
        f"suggestions indicated for internal assessment have been "
        f"incorporated in the report deposited in the departmental library. "
        f"The Internship report has been approved as it satisfies the "
        f"academic requirements in respect of Internship work prescribed "
        f"for the said Degree."
    )
    add_para(doc, cert_text, size=12,
             align=WD_ALIGN_PARAGRAPH.JUSTIFY, space_after=24)

    # Signature table
    tbl = doc.add_table(rows=4, cols=2)
    tbl.autofit = False
    rows = [
        ("………………………………….", "………………………………."),
        ("Signature of Guide", "Signature of Internship Coordinator"),
        (INTERNAL_GUIDE_NAME, COORDINATOR_NAME),
        (INTERNAL_GUIDE_DESIG, COORDINATOR_DESIG),
    ]
    for i, (l, r) in enumerate(rows):
        set_cell_text(tbl.rows[i].cells[0], l, bold=(i == 1),
                      align=WD_ALIGN_PARAGRAPH.CENTER)
        set_cell_text(tbl.rows[i].cells[1], r, bold=(i == 1),
                      align=WD_ALIGN_PARAGRAPH.CENTER)
    for row in tbl.rows:
        row.cells[0].width = Inches(3.25)
        row.cells[1].width = Inches(3.25)

    add_blank(doc, 2)
    tbl2 = doc.add_table(rows=4, cols=2)
    tbl2.autofit = False
    rows2 = [
        ("…………………………………..", "…………………………………."),
        ("Signature of HoD", "Signature of Principal"),
        (HOD_NAME, PRINCIPAL_NAME),
        (HOD_DESIG, PRINCIPAL_DESIG),
    ]
    for i, (l, r) in enumerate(rows2):
        set_cell_text(tbl2.rows[i].cells[0], l, bold=(i == 1),
                      align=WD_ALIGN_PARAGRAPH.CENTER)
        set_cell_text(tbl2.rows[i].cells[1], r, bold=(i == 1),
                      align=WD_ALIGN_PARAGRAPH.CENTER)
    for row in tbl2.rows:
        row.cells[0].width = Inches(3.25)
        row.cells[1].width = Inches(3.25)

    add_blank(doc, 2)
    add_para(doc, "EXTERNAL VIVA", size=12, bold=True, space_after=12)
    add_para(doc, "Name of the Examiners:                                "
                  "                                            Signature "
                  "of the Examiners:", size=12, bold=True, space_after=14)
    add_para(doc, "1.", size=12, space_after=18)
    add_para(doc, "2.", size=12)
    add_page_break(doc)


def build_company_certificate_page(doc):
    add_para(doc, "COMPANY CERTIFICATE",
             size=18, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER,
             space_before=180, space_after=12)
    add_para(doc, "(Attach here)", size=12, italic=True,
             align=WD_ALIGN_PARAGRAPH.CENTER, space_after=18)
    add_para(doc,
             "The original internship completion certificate issued by "
             f"{COMPANY} for the period {INTERNSHIP_FROM} to "
             f"{INTERNSHIP_TO} is attached on this page.",
             size=11, italic=True, align=WD_ALIGN_PARAGRAPH.CENTER,
             color=(0x60, 0x60, 0x60))
    add_blank(doc, 12)
    add_para(doc, "I", size=12, align=WD_ALIGN_PARAGRAPH.CENTER)
    add_page_break(doc)


def build_acknowledgment(doc):
    add_para(doc, "ACKNOWLEDGMENT",
             size=20, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER,
             color=(0xC0, 0x00, 0x00), space_after=20)

    paragraphs = [
        f"With great pride I would like to express my gratitude to "
        f"{COLLEGE}, the temple of learning, for providing me the required "
        f"platform for the fulfilment of this internship.",

        f"I express my sincere thanks to {PRINCIPAL_NAME}, Principal, "
        f"{COLLEGE_SHORT}, Kundana, for providing the excellent "
        f"infrastructure and academic environment that made this "
        f"internship possible.",

        f"I express wholehearted gratitude to {HOD_NAME}, "
        f"Professor and Head of the Department of {BRANCH_FULL}, for the "
        f"continuous support, encouragement and valuable guidance offered "
        f"throughout the internship.",

        f"I thank my Internship Coordinator {COORDINATOR_NAME}, "
        f"{COORDINATOR_DESIG}, for the periodic reviews, suggestions and "
        f"timely guidance which helped me stay on track with the project "
        f"milestones.",

        f"It is my privilege to thank my Internal Guide "
        f"{INTERNAL_GUIDE_NAME}, {INTERNAL_GUIDE_DESIG}, for the academic "
        f"supervision, technical inputs and constructive feedback that "
        f"shaped the quality of this work.",

        f"I am sincerely grateful to {EXTERNAL_GUIDE_NAME}, "
        f"{EXTERNAL_GUIDE_DESIG} at {COMPANY}, for mentoring me on the "
        f"engineering practices followed at the organisation and for the "
        f"hands-on guidance during the design, development and review of "
        f"this project.",

        f"I extend my heartfelt thanks to the entire team at {COMPANY} for "
        f"creating a learning environment where I could explore full-stack "
        f"web development, understand real-world engineering workflows and "
        f"contribute meaningfully to a production-grade application.",

        "I also thank all those who extended their support and cooperation "
        "while bringing out this internship.",

        "Finally, I would like to thank my family members and friends for "
        "their kind cooperation, encouragement and constant motivation "
        "throughout the internship work.",
    ]
    for t in paragraphs:
        add_body(doc, t, justify=True, first_line_indent=0.3)

    add_blank(doc, 2)
    add_para(doc, f"{STUDENT_NAME} ({USN})",
             size=12, bold=True, align=WD_ALIGN_PARAGRAPH.RIGHT,
             color=(0xC0, 0x00, 0x00))
    add_page_break(doc)


def build_abstract(doc):
    add_para(doc, "ABSTRACT",
             size=20, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER,
             color=(0xC0, 0x00, 0x00), space_after=24)

    paragraphs = [
        f"During my internship at {COMPANY}, I worked as a "
        f"{INTERNSHIP_TITLE_TITLECASE.replace(' Development', ' Developer')} "
        f"and gained hands-on exposure to enterprise-grade full-stack web "
        f"development. The internship combined structured training on "
        f"industry tools and engineering practices with day-to-day "
        f"project work, giving me direct experience of the complete "
        f"software development lifecycle.",

        f"As part of the internship I designed and built "
        f"“{PROJECT_NAME}”, a web platform that lets "
        f"employees book conference rooms in fixed thirty-minute slots "
        f"and lets managers administer rooms and oversee all bookings. "
        f"The project also includes an attendance module (check-in / "
        f"check-out, attendance calendar and attendance board) and a "
        f"leave-management module (leave requests and leave-balance "
        f"tracking), making it a compact employee management system.",

        "The application enforces realistic business rules — fixed "
        "30-minute slots, strict no-double-booking, owner-only "
        "cancellation and manager-only room administration — and sends "
        "email confirmations and in-app notifications on booking. It is "
        "built on the MERN stack (MongoDB, Express, React, Node.js) "
        "with JWT authentication, Mongoose data modelling, node-cron "
        "scheduling and a TypeScript-based React frontend using Vite, "
        "Tailwind CSS and shadcn/ui. The backend is deployed on Render "
        "and the frontends on Vercel.",

        "Beyond the technical learning, the internship reinforced the "
        "importance of clean code, careful edge-case thinking and clear "
        "communication. The finished project demonstrates an end-to-end "
        "full-stack workflow and is structured to be extended in future "
        "with approval workflows, analytics dashboards and mobile clients.",
    ]
    for t in paragraphs:
        add_body(doc, t, justify=True, first_line_indent=0.3)
    add_page_break(doc)


def build_contents(doc):
    add_para(doc, "CONTENTS",
             size=20, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER,
             space_after=18)

    # Top items
    tbl = doc.add_table(rows=0, cols=3)
    tbl.autofit = False

    def add_row(c1, c2, c3, bold=False):
        row = tbl.add_row().cells
        for cell, txt in zip(row, (c1, c2, c3)):
            for p in cell.paragraphs:
                p._p.getparent().remove(p._p)
            p = cell.add_paragraph()
            r = p.add_run(txt)
            set_run_font(r, size=12, bold=bold)
        row[0].width = Inches(1.0)
        row[1].width = Inches(4.5)
        row[2].width = Inches(1.0)

    add_row("", "ACKNOWLEDGMENT", "I", bold=True)
    add_row("", "ABSTRACT", "II", bold=True)
    add_row("Chapter No.", "Chapter Name", "Page No.", bold=True)

    chapters = [
        ("1", "COMPANY PROFILE", ""),
        ("", "1.1 History of the Organization", "1"),
        ("", "1.2 Major Milestones", "2"),
        ("", "1.3 Structure of the Organization", "3"),
        ("", "1.4 Services Offered", "4"),
        ("2", "ABOUT THE DEPARTMENT", ""),
        ("", "2.1 Specific Functionalities of the Department", "5"),
        ("", "2.2 Process Adopted", "6"),
        ("", "2.3 Testing", "7"),
        ("", "2.4 Structure of the Department", "8"),
        ("", "2.5 Roles and Responsibilities of Individuals", "8"),
        ("3", "TASK PERFORMED", ""),
        ("", "3.1 Introduction", "10"),
        ("", "3.2 Problem Statement", "11"),
        ("", "3.3 Objectives", "12"),
        ("", "3.4 Technologies Used", "13"),
        ("", "3.5 System Workflow", "14"),
        ("", "3.6 System Architecture", "15"),
        ("", "3.7 Modules Developed", "16"),
        ("", "3.8 Implementation", "18"),
        ("", "3.9 Features", "20"),
        ("", "3.10 Challenges", "21"),
        ("", "3.11 Result and Outcome", "22"),
        ("4", "REFLECTION NOTES", ""),
        ("", "4.1 Experience", "24"),
        ("", "4.2 Technical Outcomes", "25"),
        ("", "4.3 System Analysis and Design", "26"),
        ("", "4.4 System Architecture", "27"),
        ("", "4.5 Implementation Highlights", "28"),
        ("", "4.6 Screenshots", "29"),
        ("5", "CONCLUSION", ""),
        ("", "5.1 Conclusion", "32"),
        ("", "REFERENCES", "34"),
    ]
    for c1, c2, c3 in chapters:
        add_row(c1, c2, c3, bold=(c1 != "" or c2 in ("REFERENCES",)))

    add_page_break(doc)


def build_list_of_tables(doc):
    add_para(doc, "LIST OF TABLES",
             size=20, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER,
             space_after=18)
    tbl = doc.add_table(rows=0, cols=3)
    tbl.autofit = False

    def add_row(c1, c2, c3, bold=False):
        row = tbl.add_row().cells
        for cell, txt in zip(row, (c1, c2, c3)):
            for p in cell.paragraphs:
                p._p.getparent().remove(p._p)
            p = cell.add_paragraph()
            r = p.add_run(txt)
            set_run_font(r, size=12, bold=bold)
        row[0].width = Inches(1.2)
        row[1].width = Inches(4.3)
        row[2].width = Inches(1.0)

    add_row("Table No.", "Title", "Page No.", bold=True)
    entries = [
        ("Table 1.1",
         "Major milestones of the Meeting Room Booking & EMS project",
         "2"),
        ("Table 1.2", "Project structure and responsibilities", "3"),
        ("Table 2.1", "Summary of testing outcomes", "7"),
        ("Table 2.2",
         "Combined academic and industry structure for the internship",
         "8"),
        ("Table 3.1",
         "Technology stack of the Meeting Room Booking & EMS",
         "13"),
    ]
    for a, b, c in entries:
        add_row(a, b, c)
    add_page_break(doc)


def build_list_of_figures(doc):
    add_para(doc, "LIST OF FIGURES",
             size=20, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER,
             space_after=18)
    tbl = doc.add_table(rows=0, cols=3)
    tbl.autofit = False

    def add_row(c1, c2, c3, bold=False):
        row = tbl.add_row().cells
        for cell, txt in zip(row, (c1, c2, c3)):
            for p in cell.paragraphs:
                p._p.getparent().remove(p._p)
            p = cell.add_paragraph()
            r = p.add_run(txt)
            set_run_font(r, size=12, bold=bold)
        row[0].width = Inches(1.2)
        row[1].width = Inches(4.3)
        row[2].width = Inches(1.0)

    add_row("Figure No.", "Title", "Page No.", bold=True)
    entries = [
        ("Fig. 4.6.1",
         "Book a Meeting Room – calendar and 30-minute time-slot picker",
         "29"),
        ("Fig. 4.6.2",
         "All Bookings – aggregate manager view with filters and "
         "per-booking actions",
         "30"),
        ("Fig. 4.6.3",
         "My Attendance – daily check-in / check-out and personal "
         "attendance calendar",
         "31"),
    ]
    for a, b, c in entries:
        add_row(a, b, c)
    add_page_break(doc)


def build_chapter1(doc):
    add_heading_chapter(doc, 1, "COMPANY PROFILE")

    add_heading_section(doc, "1.1 History of the Organization")
    add_body(doc,
        f"{COMPANY} is a Bengaluru-based software services organisation "
        f"that delivers offshore application development, product "
        f"engineering and quality engineering services. The company is "
        f"headquartered at {COMPANY_ADDRESS}. Its name reflects its "
        f"India–Japan engineering heritage, and over the years the "
        f"organisation has built a reputation for delivering enterprise "
        f"software for clients with strict process and quality "
        f"expectations.")
    add_body(doc,
        "The organisation works across multiple technology stacks "
        "including the Java enterprise ecosystem, JavaScript / TypeScript "
        "and Node.js, modern frontend frameworks such as React and Vue, "
        "relational and NoSQL databases, and cloud-native deployment on "
        "AWS, Azure and Google Cloud. Engagements span the full software "
        "development lifecycle — requirement engineering, architecture "
        "and design, development, automated testing, deployment, "
        "monitoring and post-release support.")
    add_body(doc,
        "In addition to client deliveries, the organisation runs a "
        "structured internship and trainee programme aimed at bridging "
        "the gap between academic learning and industry expectations. "
        "Interns are inducted into ongoing engineering practices, "
        "exposed to real product code, given mentored work items and "
        "evaluated on the same engineering hygiene yardsticks (clean "
        "code, peer review, testing discipline, communication) that "
        "apply to full-time engineers.")

    add_heading_section(doc, "1.1.1 Objectives of the Internship")
    add_body(doc,
        "The objectives of the internship programme were oriented towards "
        "developing a practical understanding of full-stack web "
        "development and the engineering culture of a professional "
        "services organisation:")
    add_bullets(doc, [
        "To gain hands-on exposure to full-stack web development covering "
        "the React frontend, the Node.js/Express backend, MongoDB data "
        "modelling and JWT-based authentication.",
        "To understand the end-to-end software development lifecycle — "
        "requirement breakdown, design, implementation, testing and "
        "deployment.",
        "To design and develop a production-style web application "
        "(“" + PROJECT_NAME + "”) that demonstrates the learning "
        "in a single, cohesive deliverable.",
    ])

    add_heading_section(doc, "1.1.2 Operation of the Organization")
    add_body(doc,
        f"{COMPANY} operates as a software services and product "
        f"engineering organisation. Engagements are organised into "
        f"delivery units led by Delivery Managers with teams of "
        f"architects, developers, quality engineers and trainees, and "
        f"run on iterative delivery with sprint planning, daily "
        f"stand-ups and retrospectives. The internship cohort follows a "
        f"structured curriculum — an initial training block on language "
        f"fundamentals and tooling, followed by a hands-on project "
        f"block where each intern owns the design, implementation and "
        f"demo of a mid-sized application under mentor review.")
    add_page_break(doc)

    add_heading_section(doc, "1.2 Major Milestones")
    add_body(doc,
        f"The following table summarises the key milestones in the "
        f"development of the “{PROJECT_NAME}” project during "
        f"the internship period:")

    milestones = [
        ("Problem Identification",
         "Identified the operational pain point that meeting rooms in "
         "large offices are commonly booked through ad-hoc messages, "
         "shared spreadsheets or walk-up checks, leading to double "
         "bookings, no-shows and poor visibility for managers."),
        ("Requirements & PRD",
         "Captured functional and non-functional requirements: 30-minute "
         "booking slots, role-based access for employees and managers, "
         "email confirmations, attendance tracking and leave management. "
         "Defined data models for users, rooms, bookings, attendance, "
         "leaves and notifications."),
        ("Backend Development",
         "Built the Node.js + Express + MongoDB API. Implemented JWT "
         "authentication, role middleware, booking-conflict prevention "
         "via a compound unique index on (roomId, date, startTime) for "
         "active bookings, and a scheduled cron job for housekeeping."),
        ("Frontend Development",
         "Developed the React + Vite + TypeScript single-page "
         "application with Tailwind CSS and shadcn/ui. Built separate "
         "employee and manager workspaces with role-aware routing and "
         "TanStack React Query for server-state management."),
        ("Attendance & Leave Modules",
         "Added daily check-in/check-out, an attendance calendar, an "
         "attendance board for managers, leave request workflow and "
         "per-employee leave balances. These extended the system from a "
         "pure booking app to a small employee management system."),
        ("Email & Notifications",
         "Integrated Nodemailer for outbound booking confirmations and a "
         "Mongo-backed notification model surfaced to the UI through a "
         "dedicated dropdown."),
        ("Testing & Iteration",
         "Tested API endpoints with Postman, frontend flows on the dev "
         "server, and validated role boundaries, conflict prevention and "
         "edit-after-cancel behaviour. Iterated on issues raised in "
         "internal reviews."),
        ("Deployment",
         "Deployed the backend on Render (free tier with /health "
         "check) and the two frontend bundles on Vercel, with "
         "environment-driven configuration for API base URLs and CORS."),
        ("Documentation",
         "Prepared the README, project handover document, internship "
         "report and demo materials."),
    ]
    add_table_two_col(doc, milestones, col1_width=1.9, col2_width=4.6,
                      header_row=("Milestone", "Description"),
                      table_label="Table 1.1",
                      caption="Major milestones of the Meeting Room "
                              "Booking & EMS project")
    add_page_break(doc)

    add_heading_section(doc, "1.3 Structure of the Organization")
    add_body(doc,
        "Within the scope of the internship, the project was executed "
        "with a small, well-defined structure that mirrored the way the "
        "organisation runs its delivery teams. Responsibilities were "
        "distributed across product planning, development, mentorship "
        "and academic review:")
    add_table_two_col(doc, [
        ("Intern / Developer",
         f"{STUDENT_NAME} — responsible for requirements analysis, "
         f"system design, full-stack development, testing, deployment "
         f"and documentation of the project."),
        ("External Guide",
         f"{EXTERNAL_GUIDE_NAME}, {EXTERNAL_GUIDE_DESIG} at {COMPANY} — "
         f"provided industry mentorship, reviewed design decisions, "
         f"conducted code reviews and tracked weekly progress."),
        ("Internal Guide",
         f"{INTERNAL_GUIDE_NAME}, {INTERNAL_GUIDE_DESIG} — provided "
         f"academic supervision, reviewed milestones and ensured the "
         f"work aligned with university requirements."),
        ("Internship Coordinator",
         f"{COORDINATOR_NAME}, {COORDINATOR_DESIG} — coordinated the "
         f"internship logistics, scheduled reviews and ensured "
         f"compliance with the academic calendar."),
    ], col1_width=1.9, col2_width=4.6,
       header_row=("Role", "Responsibility"),
       table_label="Table 1.2",
       caption="Project structure and responsibilities")

    add_heading_section(doc, "1.4 Services Offered")
    add_body(doc,
        f"{COMPANY} provides software engineering services across "
        f"several practice areas:")
    add_bullets(doc, [
        "Application Development and Product Engineering using Java, "
        "JavaScript/TypeScript, React, Node.js and Spring Boot.",
        "Quality Engineering — manual and automated testing across "
        "unit, integration and end-to-end levels.",
        "Cloud and DevOps services on AWS, Azure and Google Cloud, "
        "including CI/CD pipelines.",
        "Structured training and internship programmes for fresh "
        "graduates covering frameworks, engineering practices and "
        "capstone projects.",
    ])
    add_page_break(doc)


def build_chapter2(doc):
    add_heading_chapter(doc, 2, "ABOUT THE DEPARTMENT")

    add_heading_section(doc, "2.1 Specific Functionalities of the Department")
    add_body(doc,
        f"The internship was carried out within the web application "
        f"engineering practice at {COMPANY}, which delivers full-stack "
        f"web and API-based products for enterprise customers. The "
        f"practice typically owns the entire stack — frontend, backend, "
        f"database, integrations and deployment — and works in "
        f"tightly-coupled pods with shared accountability for quality.")
    add_body(doc,
        "Within the scope of this internship project, the functional "
        "areas covered map directly to what the practice does for paying "
        "customers, scaled down for an internship deliverable:")
    add_bullets(doc, [
        "API Engineering: design and implementation of versioned REST "
        "endpoints in Node.js + Express, with consistent error handling, "
        "structured request validation and JWT-based authentication.",
        "Data Modelling: schema design in MongoDB using Mongoose. "
        "Includes compound indexes for conflict prevention "
        "(roomId, date, startTime) and referential modelling between "
        "users, rooms, bookings, attendance and leave entities.",
        "Frontend Engineering: component-driven UI development with "
        "React, TypeScript and Tailwind CSS, role-aware routing, "
        "TanStack React Query for server-state caching and shadcn/ui for "
        "accessible primitives.",
        "Authentication and Authorisation: token-based authentication "
        "with role middleware, protected routes on both server and "
        "client, and clean separation of employee and manager surfaces.",
        "Email and Notification Engineering: outbound email through "
        "Nodemailer with environment-driven SMTP configuration, and an "
        "in-app notification model surfaced through a dropdown component.",
        "Background Jobs: scheduled tasks using node-cron for "
        "housekeeping operations such as sweeping stale bookings.",
        "Deployment: independent deployment of the backend on Render "
        "and the frontend on Vercel, with CORS hardening and "
        "environment-driven configuration.",
    ])
    add_page_break(doc)

    add_heading_section(doc, "2.2 Process Adopted")
    add_body(doc,
        f"The development of “{PROJECT_NAME}” followed an "
        f"iterative, sprint-style process aligned with how the delivery "
        f"team works on customer projects, scaled to the internship "
        f"scope. The work moved through five phases — requirement "
        f"analysis, system design, implementation, testing and "
        f"hardening, and deployment with documentation.")
    add_body(doc,
        "Requirement analysis began by mapping the informal ways meeting "
        "rooms are booked in offices and translating that into concrete "
        "employee and manager workflows together with supporting "
        "attendance and leave modules. System design then captured the "
        "data model (users, rooms, bookings, attendance, leave, "
        "notifications) and the indexing strategy that prevents double "
        "bookings, alongside the REST surface and the UI wireframes.")
    add_body(doc,
        "Implementation proceeded module by module — authentication "
        "first, then rooms, then bookings (where most of the business "
        "logic lives), then attendance and leave, and finally email and "
        "notification integration. Testing exercised the API with "
        "Postman, verified edge cases (cancelled bookings, overlapping "
        "slots, role boundaries) and tightened CORS and environment "
        "configuration. The backend was deployed on Render and the two "
        "frontends on Vercel, with documentation captured in a README, "
        "a handover document and the present report.")
    add_page_break(doc)

    add_heading_section(doc, "2.3 Testing")
    add_body(doc,
        "Testing focused on validating the functional behaviour of each "
        "module, the correctness of business rules and the resilience "
        "of the system to common edge cases. Each module was tested "
        "independently — authentication flows for both roles, the "
        "slot-conflict guard for bookings, idempotent check-in for "
        "attendance and balance updates for leave. Role boundaries were "
        "verified by calling manager-only endpoints with employee "
        "tokens and confirming HTTP 403 responses. The UI was reviewed "
        "for ease of use across time-slot grids, calendar pickers, "
        "notification dropdowns and table filters.")

    add_table_two_col(doc, [
        ("Functional Testing",
         "All core flows (login, booking, cancellation, attendance "
         "check-in/out, leave request) operated as designed."),
        ("Conflict Prevention",
         "The compound unique index on (roomId, date, startTime) "
         "rejected overlapping active bookings as expected; duplicate "
         "attempts surfaced a clear error in the UI."),
        ("Role Boundaries",
         "Manager-only endpoints were correctly blocked for employee "
         "tokens; manager UI guards prevented unauthorised access to "
         "admin pages."),
        ("Email Confirmation",
         "Booking creation triggered an email through Nodemailer when "
         "SMTP credentials were configured; logging captured failures "
         "without crashing the request."),
        ("Notifications",
         "In-app notifications were generated for booking invites and "
         "displayed in the navbar dropdown with unread counts."),
        ("Deployment Health",
         "The /health endpoint returned 200 OK; both Vercel frontends "
         "could authenticate against the Render-hosted API with the "
         "expected CORS behaviour."),
    ], col1_width=2.0, col2_width=4.5,
       header_row=("Test Type", "Outcome"),
       table_label="Table 2.1",
       caption="Summary of testing outcomes")
    add_page_break(doc)

    add_heading_section(doc, "2.4 Structure of the Department")
    add_body(doc,
        "The internship was supervised under the Department of "
        f"{BRANCH_FULL} at {COLLEGE}, with industry mentorship at "
        f"{COMPANY}. The combined structure relevant to this project is:")
    add_table_two_col(doc, [
        (f"Department of {BRANCH_SHORT}, {COLLEGE_SHORT}",
         "Academic home — provided infrastructure, faculty guidance and "
         "the academic framework for the internship report."),
        ("Faculty Internship Coordinator",
         "Coordinated the internship logistics, scheduled review "
         "milestones and verified academic compliance."),
        ("Internal Guide",
         "Reviewed the project at each milestone, provided technical "
         "feedback and signed off on the report."),
        ("External Guide",
         f"{EXTERNAL_GUIDE_NAME} at {COMPANY} — owned the day-to-day "
         f"mentorship, code reviews and engineering supervision."),
        ("Intern",
         f"{STUDENT_NAME} — sole developer and product owner for the "
         f"project."),
    ], col1_width=2.2, col2_width=4.3,
       header_row=("Entity", "Role in Project"),
       table_label="Table 2.2",
       caption="Combined academic and industry structure for the internship")

    add_heading_section(doc, "2.5 Roles and Responsibilities of Individuals")
    add_body(doc,
        "As the developer of the project, my responsibilities spanned "
        "every phase of the application development lifecycle. The key "
        "responsibilities are listed below:")
    add_bullets(doc, [
        "Requirement Analysis: translating the operational pain points "
        "around meeting-room booking, attendance and leave into a "
        "concrete set of features, data models and API contracts.",
        "System Design: designing the data model, indexing strategy, "
        "REST API surface, role-based access matrix and the route map "
        "for the React application.",
        "Backend Development: implementing controllers, services, "
        "middlewares, models and routes for authentication, rooms, "
        "bookings, attendance, leave and notifications.",
        "Frontend Development: building the React + TypeScript SPA, the "
        "employee and manager workspaces, the shared shadcn/ui "
        "components and the API hooks layer using TanStack React Query.",
        "Integration and Deployment: wiring up environment "
        "configuration, deploying the backend on Render and the "
        "frontends on Vercel, and validating CORS and health checks in "
        "production.",
        "Testing and Debugging: writing manual test plans, exercising "
        "endpoints with Postman, reproducing reported issues and "
        "fixing them before review.",
        "Documentation: maintaining the README, the project handover "
        "document and the present internship report.",
    ])
    add_page_break(doc)


def build_chapter3(doc):
    add_heading_chapter(doc, 3, "TASK PERFORMED")

    add_heading_section(doc, "3.1 Introduction")
    add_body(doc,
        f"This chapter describes the technical work carried out during "
        f"the internship — from problem identification and requirement "
        f"analysis through design, implementation, testing and deployment "
        f"of the project titled “{PROJECT_NAME}”. The project "
        f"is a web-based platform that lets employees of an organisation "
        f"book meeting rooms in fixed time slots, lets managers manage "
        f"rooms and oversee all bookings, and bundles in supporting "
        f"modules for attendance and leave management.")
    add_body(doc,
        "The work involved every layer of a modern full-stack web "
        "application: a React + TypeScript single-page frontend built "
        "with Vite, a Node.js + Express REST API, a MongoDB database "
        "accessed through Mongoose, JWT-based authentication, "
        "Nodemailer-driven outbound email, node-cron scheduled tasks, "
        "and independent deployment of the backend and frontends to "
        "Render and Vercel respectively. Throughout the project, "
        "engineering practices such as version control, code review, "
        "environment-driven configuration and clear separation of "
        "concerns were applied.")

    add_heading_section(doc, "3.2 Problem Statement")
    add_body(doc,
        "In medium and large offices, conference and meeting rooms are "
        "a constrained shared resource. They are often booked through "
        "ad-hoc means — instant messages, shared spreadsheets, walk-up "
        "checks or paper sign-up sheets. This informal model creates "
        "several recurring problems:")
    add_bullets(doc, [
        "Double bookings: two teams arrive expecting the same room at "
        "the same time, leading to last-minute disruption.",
        "No-shows: a room is booked but never used, blocking other "
        "teams that could have benefited from it.",
        "Poor visibility for managers: there is no single place to see "
        "the current and historical utilisation of rooms across "
        "branches.",
        "Manual operational overhead: room metadata (capacity, "
        "amenities, branch) is hard to keep up to date when there is "
        "no system of record.",
        "Disconnected employee-management workflows: attendance and "
        "leave tracking typically live in entirely separate tools, "
        "fragmenting the day-to-day workflow.",
    ])
    add_body(doc,
        f"The “{PROJECT_NAME}” addresses these problems by "
        f"providing a single web application with two role-specific "
        f"workspaces: employees can search for rooms, pick a 30-minute "
        f"slot and book it with immediate email confirmation, while "
        f"managers can create and edit rooms, oversee all bookings "
        f"across branches, manage attendance and process leave "
        f"requests — all from one place.")
    add_page_break(doc)

    add_heading_section(doc, "3.3 Objectives")
    add_body(doc, "The project was developed with the following objectives:")
    add_bullets(doc, [
        "Build a role-aware web application with separate employee and "
        "manager experiences, where access to administrative actions is "
        "restricted by role.",
        "Implement a slot-based meeting-room booking system with strict "
        "conflict prevention: no two active bookings can occupy the "
        "same (room, date, start-time) tuple.",
        "Provide managers with full CRUD over the rooms catalogue, "
        "together with a unified view of all bookings across employees "
        "and branches and filters for date, branch, room and employee.",
        "Add an attendance module with daily check-in / check-out, a "
        "personal attendance calendar and an attendance board for "
        "managers to monitor team-level attendance.",
        "Add a leave-management module with leave requests, per-employee "
        "leave balances, history of past requests and an approval surface.",
        "Send outbound email confirmations on booking creation and "
        "surface in-app notifications for invitees so participants are "
        "aware of upcoming meetings.",
        "Secure the API using JWT-based authentication and role "
        "middleware, with consistent error handling and request "
        "validation at the boundary.",
        "Deploy the backend and the two frontend bundles to managed "
        "cloud platforms (Render and Vercel) with environment-driven "
        "configuration.",
        "Apply professional engineering practices throughout — clean "
        "code, modular structure, version control, code review and "
        "documentation.",
    ])

    add_heading_section(doc, "3.4 Technologies Used")
    add_body(doc,
        "The technology stack was chosen to combine industry relevance "
        "with development velocity. The major components are summarised "
        "in the table below:")
    add_table_two_col(doc, [
        ("Frontend Framework",
         "React 18 with TypeScript, scaffolded by Vite. React Router v6 "
         "for routing, TanStack React Query for server-state caching."),
        ("UI Library",
         "Tailwind CSS for utility-first styling, shadcn/ui and Radix "
         "primitives for accessible components."),
        ("Backend Framework",
         "Node.js with Express 4, using ES modules and modern "
         "async/await control flow."),
        ("Database",
         "MongoDB accessed through Mongoose. A compound unique index on "
         "(roomId, date, startTime) — restricted to active bookings — "
         "enforces no-overlap at the storage layer."),
        ("Authentication",
         "JSON Web Tokens (JWT) for stateless authentication, with "
         "role-based middleware to gate manager-only endpoints. "
         "Passwords hashed using bcrypt."),
        ("Email",
         "Nodemailer with environment-driven SMTP credentials for "
         "booking confirmations and invite emails."),
        ("Scheduling",
         "node-cron for periodic background tasks (housekeeping sweeps, "
         "stale-booking handling)."),
        ("Security & Hardening",
         "Helmet for HTTP header hardening, CORS allow-list driven by "
         "CLIENT_URLS environment variable, and structured error "
         "middleware."),
        ("Tooling",
         "Git for version control, ESLint and TypeScript for static "
         "checks, Postman for API exploration, nodemon for development "
         "auto-reload."),
        ("Deployment",
         "Backend on Render (Web Service with /health probe), two "
         "frontends on Vercel — each with its own environment-driven "
         "API base URL."),
    ], col1_width=2.0, col2_width=4.5,
       header_row=("Component", "Technology / Notes"),
       table_label="Table 3.1",
       caption="Technology stack of the Meeting Room Booking & EMS")
    add_page_break(doc)

    add_heading_section(doc, "3.5 System Workflow")
    add_body(doc,
        "The application supports two distinct workflows determined by "
        "the user's role. Both flows share authentication and the "
        "underlying notification mechanism.")
    add_heading_section(doc, "Employee Workflow", size=12)
    add_numbered(doc, [
        "Employee opens the application and signs in. The frontend "
        "calls POST /api/auth/login, receives a JWT and stores it in "
        "localStorage as app_token.",
        "The employee lands on the dashboard, which shows upcoming "
        "meetings fetched via GET /api/bookings/my.",
        "To book a room, the employee opens the Book Room page, picks "
        "a date in the calendar, selects a 30-minute time slot from the "
        "slot grid and chooses a room from the available rooms list.",
        "On submission, the frontend calls POST /api/bookings; the "
        "backend validates the slot, rejects overlaps using the "
        "compound index, persists the booking, sends a Nodemailer "
        "email and creates in-app notifications for invitees.",
        "The employee can later cancel their booking from Manage "
        "Bookings, view past bookings under Booking History, check in "
        "for attendance from My Attendance, and submit leave requests "
        "from Leave Requests.",
    ])
    add_heading_section(doc, "Manager Workflow", size=12)
    add_numbered(doc, [
        "Manager signs in and lands on the manager dashboard, which "
        "surfaces aggregate booking statistics.",
        "From Manage Rooms / Create Room the manager performs CRUD on "
        "the rooms catalogue (name, branch, capacity, amenities).",
        "From All Bookings the manager filters by date, branch, room or "
        "employee to inspect bookings; from Room Availability they see "
        "real-time occupancy.",
        "Attendance Board surfaces team-level attendance for the day; "
        "Leave Requests allow the manager to act on pending leave "
        "submissions.",
        "Managers can also book rooms themselves and view their own "
        "history, using the same booking surface employees use.",
    ])
    add_page_break(doc)

    add_heading_section(doc, "3.6 System Architecture")
    add_body(doc,
        "The system follows a layered architecture with a clear "
        "separation between presentation, application and data layers, "
        "and with independently deployable frontend and backend.")
    add_bullets(doc, [
        "Presentation Layer: React + TypeScript SPA built with Vite. "
        "Routes are split into employee (/dashboard, /book-room, "
        "/manage-bookings, /booking-history, /notifications, /profile) "
        "and manager (/manager, /manager/book-room, /manager/all-bookings, "
        "/manager/create-room, /manager/manage-rooms, /manager/room-availability, "
        "/manager/notifications, /manager/profile) trees, with a "
        "ProtectedRoute wrapper enforcing role-based access.",
        "Application Layer: Express controllers handle the HTTP surface; "
        "service modules encapsulate business rules (booking conflict "
        "checks, leave balance updates, attendance idempotency); "
        "middleware layers handle authentication, role enforcement and "
        "error formatting.",
        "Data Layer: MongoDB via Mongoose. Models include User, Room, "
        "Booking, Attendance, Leave, LeaveBalance and Notification. The "
        "Booking model carries a compound unique index on "
        "(roomId, date, startTime) with a partial filter restricting it "
        "to active bookings, so cancellations free the slot up.",
        "Notification Layer: an in-app notification model surfaced "
        "through GET /api/notifications and PUT /api/notifications/:id/read; "
        "outbound email via Nodemailer with environment-driven SMTP "
        "credentials.",
        "Scheduling Layer: node-cron drives periodic tasks for "
        "housekeeping (for example, sweeping bookings whose end-time "
        "has passed).",
        "Deployment: independent deployments — backend on Render with a "
        "/health probe; the main frontend and a public-rooms display "
        "frontend on Vercel, each pointed at the same API.",
    ])
    add_page_break(doc)

    add_heading_section(doc, "3.7 Modules Developed")
    add_body(doc,
        "The application is organised into eight modules. Each owns its "
        "routes, controllers, services and models on the backend, and "
        "its pages and components on the frontend.")
    add_bullets(doc, [
        "Authentication: bcrypt password hashing, JWT issuance, role "
        "claims and a frontend AuthContext that drives ProtectedRoute "
        "and role-aware navigation (/auth/login, /register, /profile, "
        "/logout).",
        "Rooms: manager-only CRUD over the rooms catalogue with a "
        "public read surface; each room carries name, branch, capacity "
        "and amenities (/rooms, /rooms/availability).",
        "Bookings: the core of the system. Fixed 30-minute slots, "
        "database-level no-overlap enforcement, owner-only cancel and "
        "confirm-occupancy endpoints, plus a calendar, slot grid and "
        "invite-members UI.",
        "Attendance: daily check-in/check-out, personal attendance "
        "calendar marking present / absent / late, and a manager-side "
        "Attendance Board. Check-in is idempotent per (user, date).",
        "Leave Management: leave requests (submit, view, cancel "
        "pending), per-employee Leave Balances and a manager approval "
        "surface that atomically decrements the corresponding balance.",
        "Notifications: in-app notification store surfaced through a "
        "navbar dropdown with unread counts (/notifications, "
        "/notifications/:id/read).",
        "Email: Nodemailer-driven outbound mail for booking "
        "confirmations, with SMTP credentials sourced from environment "
        "variables so secrets stay out of source control.",
        "Scheduled Tasks: node-cron jobs inside the API process sweep "
        "stale bookings and emit reminders.",
    ])
    add_page_break(doc)

    add_heading_section(doc, "3.8 Implementation")
    add_body(doc,
        "Implementation proceeded module by module on both the backend "
        "and the frontend, with continuous integration of new modules "
        "into the running application. The notable implementation "
        "highlights are summarised below.")
    add_bullets(doc, [
        "The booking conflict guard relies on a MongoDB compound "
        "unique index with a partial filter that targets active "
        "bookings only — cancellations therefore free the slot up "
        "without violating the constraint.",
        "Time-slot generation is shared between the frontend "
        "(slotGenerator.ts) and the backend (utils/generateSlots.js) "
        "so client and server stay aligned.",
        "AuthContext.tsx calls /auth/me on mount with the persisted "
        "JWT; ProtectedRoute supports a requireRole prop that enforces "
        "the employee vs manager surfaces.",
        "Frontend API calls are encapsulated under frontend/src/api "
        "and consumed via TanStack React Query hooks, so caching and "
        "invalidation are centralised.",
        "Deployment is configured declaratively — render.yaml at the "
        "server root for Render and vercel.json files in the two "
        "frontend roots for Vercel — and driven by environment "
        "variables for API base URLs and CORS allow-lists.",
    ])
    add_page_break(doc)

    add_heading_section(doc, "3.9 Features")
    add_bullets(doc, [
        "Role-based authentication with JWT and a clean separation of "
        "employee and manager workspaces.",
        "Slot-based meeting-room booking with strict database-level "
        "conflict prevention.",
        "Manager-only room catalogue management with branch, capacity "
        "and amenity metadata.",
        "Calendar and time-slot picker UI with Available / Booked / "
        "Selected indicators, plus manager-level filters across dates, "
        "branches, rooms and employees.",
        "Attendance and leave modules — daily check-in/check-out, "
        "personal attendance calendar, team Attendance Board, leave "
        "requests, leave balances and approval workflow.",
        "Outbound email confirmations via Nodemailer and an in-app "
        "notification dropdown.",
        "Independent cloud deployment — backend on Render, frontends "
        "on Vercel — with environment-driven configuration and CORS "
        "hardening.",
    ])

    add_heading_section(doc, "3.10 Challenges")
    add_body(doc,
        "Several engineering challenges were encountered and resolved "
        "during the project:")
    add_bullets(doc, [
        "Conflict prevention: pushed the no-overlap invariant down to "
        "MongoDB with a compound unique index restricted to active "
        "bookings, so two simultaneous requests cannot both succeed and "
        "cancellations correctly free the slot up.",
        "Role-aware routing: introduced a requireRole prop on "
        "ProtectedRoute and a role-aware landing redirect, so "
        "deep-linked manager URLs are blocked for employees.",
        "Free-tier deployment behaviour: Render's free services sleep "
        "after ~15 minutes of inactivity, which pauses node-cron jobs. "
        "Mitigated by documenting the caveat and suggesting an external "
        "health-check pinger.",
        "Multi-frontend CORS: two Vercel deployments needed to talk to "
        "the same API. Resolved with a CLIENT_URLS comma-separated "
        "allow-list enforced only in production.",
        "Query-cache invalidation: ensuring the right TanStack React "
        "Query keys are invalidated on mutations like cancellation or "
        "leave approval. Resolved by colocating keys with each hook "
        "module.",
    ])
    add_page_break(doc)

    add_heading_section(doc, "3.11 Result and Outcome")
    add_body(doc,
        "By the end of the internship, the project was operational "
        "end-to-end:")
    add_bullets(doc, [
        "All planned modules — authentication, rooms, bookings, "
        "attendance, leave and notifications — were implemented, "
        "integrated and exercised by both roles.",
        "The no-overlap booking invariant was verified through "
        "concurrent test cases and cancellations correctly freed slots.",
        "Booking confirmations were dispatched via Nodemailer and "
        "in-app notifications were surfaced through the dropdown.",
        "The backend ran on Render with a passing /health probe and "
        "both Vercel frontends successfully consumed the API.",
        "The codebase, README, handover document and this report leave "
        "the project in a state where it can be picked up and extended "
        "by another developer.",
    ])
    add_page_break(doc)


def build_chapter4(doc):
    add_heading_chapter(doc, 4, "REFLECTION NOTES")

    add_heading_section(doc, "4.1 Experience")
    add_body(doc,
        f"The internship at {COMPANY} was a turning point in the way I "
        f"think about software engineering. Unlike classroom projects, "
        f"a real internship deliverable — built over weeks, reviewed by "
        f"senior engineers and deployed to a public URL — forces you to "
        f"live with the consequences of every architectural choice. "
        f"That continuity changed how I approached each decision in the "
        f"project, from where the booking-conflict check should live to "
        f"how role guards should be expressed.")
    add_body(doc,
        "On the workflow side, I became comfortable with the rhythm of "
        "professional engineering — branching off main, opening pull "
        "requests, addressing review comments, demoing changes — and "
        "learnt that disciplined engineering is mostly about consistent "
        "small habits. On the people side, the clearest improvements "
        "in the project came not from solo coding but from short "
        "conversations with mentors about the right indexing strategy, "
        "the right way to model role permissions and the right level "
        "of abstraction for the React hooks.")

    add_heading_section(doc, "4.2 Technical Outcomes")
    add_bullets(doc, [
        "Full-stack web development with the MERN stack — React + "
        "TypeScript on the frontend; Node.js, Express, MongoDB and "
        "Mongoose on the backend.",
        "JWT-based authentication with role-based authorisation, "
        "separating server-enforced middleware guards from client-side "
        "UX guards.",
        "MongoDB schema design with compound indexes and partial "
        "filters to enforce real business invariants at the storage layer.",
        "TanStack React Query for server-state management — keying, "
        "cache invalidation and the server-state / client-state split.",
        "Operational concerns: scheduled tasks with node-cron, outbound "
        "email with Nodemailer, HTTP hardening with Helmet and password "
        "hashing with bcrypt.",
        "Cloud deployment to Render and Vercel with health checks and "
        "environment-driven configuration, plus Git, ESLint and "
        "structured documentation as everyday engineering discipline.",
    ])
    add_page_break(doc)

    add_heading_section(doc, "4.3 System Analysis and Design")
    add_body(doc,
        "System analysis began with the recognition that the problem "
        "is fundamentally about a shared, finite resource — meeting "
        "rooms — combined with the supporting workflows around "
        "employees who use them. Two axes of design emerged: the data "
        "model must guarantee no two active bookings overlap on the "
        "same room and slot, and the interface must give employees "
        "and managers different — but consistent — surfaces over the "
        "same data.")
    add_body(doc,
        "Design proceeded layer by layer. The data layer was modelled "
        "in Mongoose with User, Room, Booking, Attendance, Leave, "
        "LeaveBalance and Notification documents. The application "
        "layer was sliced into controllers, services, middlewares and "
        "utility modules. The presentation layer was designed around "
        "two route trees — employee and manager — served by a single "
        "React application with a ProtectedRoute wrapper enforcing "
        "role guards. The booking conflict guard was pushed down to "
        "the database via a compound unique index with a partial "
        "filter, so no race condition in the application layer can "
        "violate the invariant.")

    add_heading_section(doc, "4.4 System Architecture")
    add_body(doc,
        "The architecture follows a classic layered design with a "
        "clear deployment boundary between the React frontends and the "
        "Express API:")
    add_bullets(doc, [
        "Presentation: React 18 + TypeScript SPA (Vite, Tailwind CSS, "
        "shadcn/ui, TanStack React Query) with role-aware routing via "
        "ProtectedRoute.",
        "API: Node.js + Express with routes → controllers → services, "
        "and middleware layers for authentication, role enforcement "
        "and error formatting.",
        "Data: MongoDB via Mongoose with the compound unique index "
        "that guarantees booking non-overlap.",
        "Cross-cutting: node-cron for housekeeping, Nodemailer for "
        "outbound email and Helmet for HTTP hardening.",
        "Deployment topology: Render hosts the backend with a /health "
        "probe; Vercel hosts the main frontend and a rooms-display "
        "SPA, each pointed at the API through environment variables.",
    ])

    add_heading_section(doc, "4.5 Implementation Highlights")
    add_bullets(doc, [
        "Modular structure on both ends — routes / controllers / "
        "services / models / middlewares on the backend; api / hooks / "
        "pages / components / contexts on the frontend — keeps the "
        "codebase navigable as it grows.",
        "The booking non-overlap invariant is enforced by the "
        "database, not the application, so racing requests cannot "
        "corrupt the state.",
        "A single SPA serves both roles; the routes and navigation it "
        "exposes are driven by the JWT payload's role claim, so "
        "employees cannot accidentally land on a manager surface.",
        "Every API call flows through frontend/src/api/*, centralising "
        "base-URL configuration, auth header injection and error "
        "handling.",
        "Deployment is declarative — render.yaml at the server root "
        "and vercel.json in each frontend root — so the whole pipeline "
        "is reproducible from the repository.",
    ])
    add_page_break(doc)

    add_heading_section(doc, "4.6 Screenshots")
    add_body(doc,
        "The following screenshots illustrate the running application. "
        "Each screenshot was captured from the production deployment "
        f"(meeting-room-booking-and-employee-m.vercel.app) and "
        f"demonstrates a key surface of the system.")

    screenshots_dir = (
        r"C:\Users\varsh\OneDrive\Pictures\Screenshots"
    )
    add_screenshot(
        doc,
        f"{screenshots_dir}\\Screenshot (61).png",
        "Fig. 4.6.1",
        "Book a Meeting Room – calendar and 30-minute time-slot picker.",
        width_inches=6.0,
    )
    add_screenshot(
        doc,
        f"{screenshots_dir}\\Screenshot (62).png",
        "Fig. 4.6.2",
        "All Bookings – aggregate manager view with filters and per-booking actions.",
        width_inches=6.0,
    )
    add_screenshot(
        doc,
        f"{screenshots_dir}\\Screenshot (63).png",
        "Fig. 4.6.3",
        "My Attendance – daily check-in / check-out and personal attendance calendar.",
        width_inches=6.0,
    )

    add_page_break(doc)


def build_chapter5(doc):
    add_heading_chapter(doc, 5, "CONCLUSION")

    add_heading_section(doc, "5.1 Conclusion")
    add_body(doc,
        f"The internship at {COMPANY} as a "
        f"{INTERNSHIP_TITLE_TITLECASE.replace(' Development', ' Developer')} "
        f"has been one of the most rewarding phases of my engineering "
        f"studies. It gave me the opportunity to take a real "
        f"requirement — a structured way to book shared meeting rooms "
        f"alongside everyday employee-management workflows — and turn "
        f"it into a deployed, working application that I could "
        f"demonstrate end-to-end.")
    add_body(doc,
        "Technically, the project gave me working knowledge of the "
        "MERN stack and the engineering ecosystem around it: data "
        "models that enforce real business invariants, secure REST "
        "APIs with JWT and role-based middleware, accessible React "
        "interfaces, server-state management with TanStack React "
        "Query, scheduled background tasks, outbound email and "
        "independent cloud deployment to Render and Vercel. The "
        "internship also reinforced that disciplined engineering is "
        "mostly about consistent small habits — readable code, small "
        "pull requests, documented decisions and deployment treated "
        "as part of the feature.")
    add_body(doc,
        f"In conclusion, the “{PROJECT_NAME}” project "
        f"represents both a concrete technical deliverable and a "
        f"personal milestone in my journey towards becoming a "
        f"professional software engineer. The system can be extended "
        f"with approval workflows, real-time WebSocket updates, "
        f"analytics dashboards on utilisation and attendance, mobile "
        f"clients, single sign-on and an automated CI test pipeline. "
        f"I am grateful to {COMPANY}, my external guide "
        f"{EXTERNAL_GUIDE_NAME} and the faculty at {COLLEGE} for "
        f"making this a rich and valuable learning experience.")
    add_page_break(doc)


def build_references(doc):
    add_para(doc, "REFERENCES",
             size=20, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER,
             space_after=18)
    refs = [
        "MongoDB Inc. (2024). MongoDB Manual. Retrieved from "
        "https://www.mongodb.com/docs/manual/",
        "Mongoose. (2024). Mongoose ODM Documentation. Retrieved from "
        "https://mongoosejs.com/docs/",
        "OpenJS Foundation. (2024). Node.js Documentation. Retrieved "
        "from https://nodejs.org/en/docs",
        "OpenJS Foundation. (2024). Express.js Guide. Retrieved from "
        "https://expressjs.com/en/guide/routing.html",
        "Meta Platforms, Inc. (2024). React Documentation. Retrieved "
        "from https://react.dev/",
        "Microsoft. (2024). TypeScript Handbook. Retrieved from "
        "https://www.typescriptlang.org/docs/",
        "Evan You and contributors. (2024). Vite Documentation. "
        "Retrieved from https://vitejs.dev/guide/",
        "Tailwind Labs. (2024). Tailwind CSS Documentation. Retrieved "
        "from https://tailwindcss.com/docs",
        "shadcn. (2024). shadcn/ui Component Library. Retrieved from "
        "https://ui.shadcn.com/docs",
        "TanStack. (2024). TanStack Query Documentation. Retrieved "
        "from https://tanstack.com/query/latest",
        "Auth0. (2024). Introduction to JSON Web Tokens. Retrieved "
        "from https://jwt.io/introduction",
        "Nodemailer. (2024). Nodemailer Documentation. Retrieved from "
        "https://nodemailer.com/about/",
        "node-cron. (2024). node-cron Documentation. Retrieved from "
        "https://www.npmjs.com/package/node-cron",
        "Render. (2024). Render Web Services Documentation. Retrieved "
        "from https://render.com/docs",
        "Vercel. (2024). Vercel Documentation. Retrieved from "
        "https://vercel.com/docs",
    ]
    for i, r in enumerate(refs, start=1):
        p = doc.add_paragraph()
        p.paragraph_format.left_indent = Inches(0.25)
        p.paragraph_format.first_line_indent = Inches(-0.25)
        p.paragraph_format.space_after = Pt(6)
        run = p.add_run(f"[{i}] ")
        set_run_font(run, size=12, bold=True)
        run2 = p.add_run(r)
        set_run_font(run2, size=12)


# ---------- Main ----------------------------------------------------------
def main():
    doc = Document()
    # Set default font + page setup
    style = doc.styles["Normal"]
    style.font.name = "Times New Roman"
    style.font.size = Pt(12)
    # East Asian fallback
    rPr = style.element.get_or_add_rPr() if hasattr(style.element,
                                                    "get_or_add_rPr") else None
    if rPr is not None:
        rFonts = rPr.find(qn("w:rFonts"))
        if rFonts is None:
            rFonts = OxmlElement("w:rFonts")
            rPr.append(rFonts)
        rFonts.set(qn("w:eastAsia"), "Times New Roman")
    section = doc.sections[0]
    section.top_margin = Inches(1)
    section.bottom_margin = Inches(1)
    section.left_margin = Inches(1)
    section.right_margin = Inches(1)

    configure_header_footer(doc)
    add_page_border(doc)

    # Body
    build_cover_page(doc)
    build_certificate_page(doc)
    build_company_certificate_page(doc)
    build_acknowledgment(doc)
    build_abstract(doc)
    build_contents(doc)
    build_list_of_tables(doc)
    build_list_of_figures(doc)
    build_chapter1(doc)
    build_chapter2(doc)
    build_chapter3(doc)
    build_chapter4(doc)
    build_chapter5(doc)
    build_references(doc)

    output_path = "Varshini_Internship_Report.docx"
    doc.save(output_path)
    print(f"OK: wrote {output_path}")


if __name__ == "__main__":
    main()
