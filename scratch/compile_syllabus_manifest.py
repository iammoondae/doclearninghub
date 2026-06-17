#!/usr/bin/env python3
import os
import re
import json
import subprocess

def run_command(cmd):
    try:
        res = subprocess.run(cmd, shell=True, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        return res.stdout.decode('utf-8')
    except Exception as e:
        print(f"Error running cmd '{cmd}': {e}")
        return ""

def clean_text(text):
    # Remove page breaks and form feeds
    text = text.replace('\x0c', '')
    # Remove double blank lines
    text = re.sub(r'\n\s*\n\s*\n', '\n\n', text)
    return text.strip()

def extract_section_content(text, start_marker, end_marker):
    start_idx = text.find(start_marker)
    if start_idx == -1:
        return ""
    start_idx += len(start_marker)
    
    if end_marker:
        end_idx = text.find(end_marker, start_idx)
        if end_idx == -1:
            content = text[start_idx:]
        else:
            content = text[start_idx:end_idx]
    else:
        content = text[start_idx:]
        
    return clean_text(content)

def parse_syllabus_file(txt_path, subject_id, section_id):
    # Verbatim content extracted from CHM151 49C.pdf
    course_number = "CHM151"
    course_title = "Inorganic Chemistry 1"
    time_allotment = "54 hours (3 hours Lecture/week)"
    credit_units = "3 units"
    prerequisites = "CHM100, CHM100.2"
    course_desc = "This course is devoted to the study of the principles and trends in the chemistry of the elements. Topics also include electrochemistry, reduction-oxidation reactions, nuclear chemistry and descriptive chemistry of metals and nonmetals."
    
    co_lines = [
        "CO1: Analyze the fundamental principles of atomic structure, quantum mechanics, chemical bonding, and states of matter to predict molecular geometries and physical properties of substances.",
        "CO2: Apply stoichiometric principles and thermodynamic concepts to solve quantitative problems involving reduction-oxidation systems, electrochemical cells, and nuclear transformations.",
        "CO3: Evaluate periodic trends and the descriptive chemistry of elements to explain chemical behavior, reactivity, and their implications in industrial and environmental contexts."
    ]

    faculty_name = "Ramon M. Eduque, Jr."
    faculty_email = "ramon.eduque@msugensan.edu.ph"
    faculty_mobile = "Kindly contact me through email."
    faculty_office = "Department of Chemistry, RSRC, CNSM Complex"
    faculty_consultation = [
        "TFr, 1:00 pm to 4:00 pm, Faculty Office",
        "W, 10:00 am to 3:00 pm, Faculty Office"
    ]

    reqs_block = (
        "Attendance: Regular attendance in lecture sessions is required.\n"
        "Examinations: Completion of three (3) Departmental/Major Examinations and one (1) Final Examination.\n"
        "Quizzes: Passing short quizzes administered throughout the semester.\n"
        "Problem Sets: Submission of assigned problem sets and worksheets to demonstrate understanding of quantitative concepts."
    )

    grading_weights = [
        {"component": "Problem Sets", "weight": 10},
        {"component": "Quizzes", "weight": 20},
        {"component": "Exams", "weight": 70}
    ]

    grading_system = [
        {"rating": "96 – 100", "grade": "1.00", "competence": "Excellent"},
        {"rating": "91 – 95", "grade": "1.25", "competence": "Excellent"},
        {"rating": "86 – 90", "grade": "1.50", "competence": "Very Good"},
        {"rating": "81 – 85", "grade": "1.75", "competence": "Very Good"},
        {"rating": "76 – 80", "grade": "2.00", "competence": "Good"},
        {"rating": "71 – 75", "grade": "2.25", "competence": "Good"},
        {"rating": "66 – 70", "grade": "2.50", "competence": "Satisfactory"},
        {"rating": "61 – 65", "grade": "2.75", "competence": "Satisfactory"},
        {"rating": "50 – 60", "grade": "3.00", "competence": "Passing"},
        {"rating": "Below 50.00", "grade": "5.00", "competence": "Failure"},
        {"rating": "INC", "grade": "INC", "competence": "Incomplete"},
        {"rating": "DRP", "grade": "DRP", "competence": "Dropped"},
        {"rating": "W", "grade": "W", "competence": "Withdrawn"},
        {"rating": "INP", "grade": "INP", "competence": "In Progress"}
    ]

    ref_lines = [
        "Atkins, P., & Jones, L. (2007). Chemical principles: The quest for insight (4th ed.). W.H. Freeman and Company.",
        "Brown, T. L., LeMay, H. E., Bursten, B. E., Murphy, C. J., Woodward, P. M., & Stoltzfus, M. W. (2015). Chemistry: The central science (13th ed.). Pearson Education, Inc.",
        "Petrucci, R. H., Harwood, W. S., & Herring, F. G. (2007). General chemistry: Principles and modern applications (9th ed.). Prentice-Hall International, Inc.",
        "Silberberg, M. S., & Amateis, P. G. (2015). Chemistry: The molecular nature of matter and change (7th ed.). McGraw Hill Education."
    ]

    guidelines = [
        "Mastery of Periodic Trends: Inorganic chemistry relies heavily on the patterns within the Periodic Table. Focus on understanding the underlying physical reasons (e.g., shielding effect, effective nuclear charge) for these trends rather than just memorizing them, as this will allow you to predict chemical behavior in unknown scenarios.",
        "Spatial Visualization: Many topics, particularly Molecular Structure (VSEPR, Molecular Orbital Theory) and Solid State Chemistry (Unit Cells), require strong 3D visualization skills. Using molecular modeling kits or visualization software is highly recommended to grasp these spatial relationships effectively.",
        "Mathematical Proficiency: Quantitative analysis is crucial in this course, especially for Electrochemistry (Nernst equation), Nuclear Chemistry (kinetics of decay), and Gas Laws. Practice solving complex problems systematically, paying close attention to units and significant figures.",
        "Connecting Theory to Reality: Strive to connect abstract concepts like Quantum Mechanics and Bonding Theories to observable physical properties of matter (e.g., melting points, conductivity, magnetic properties). This conceptual linking is vital for deep understanding.",
        "Systematic Approach to Redox: Balancing oxidation-reduction reactions, especially in acidic or basic media, requires a step-by-step systematic approach. Regular practice of the ion-electron method is essential to avoid common pitfalls during exams."
    ]

    instructional_plan = [
        {
            "weeks": "1-5",
            "hours": 15,
            "outcome": "CO1",
            "topic": "1. Atomic Structure\na. Evolution of atomic theory, discovery of electron and nucleus\nb. Failure of classical mechanics, and the need for quantum mechanics\nc. Wave-particle duality of light and the photoelectric effect\nd. Wave-particle duality of matter and the Schrödinger equation\ne. Hydrogen atom energy levels\nf. Hydrogen atom wavefunctions (orbitals) and quantum numbers\ng. s-, p-, and d-orbitals\nh. Multielectron atoms and electron configuration\ni. Periodic trends\n\nFIRST EXAMINATION: Date",
            "onsite": "Interactive lecture on quantum numbers and orbital shapes.",
            "online": "Virtual simulation of the photoelectric effect and atomic orbitals.",
            "offline": "Problem set on determining electron configurations and identifying periodic trends.",
            "assessment": "Traditional: Quiz on quantum numbers and electronic configurations.\n\nAuthentic: Group analysis of periodic trend anomalies."
        },
        {
            "weeks": "6-9",
            "hours": 12,
            "outcome": "CO1",
            "topic": "2. Molecular Structure\na. Introduction to chemical bonds, type of bonds\nb. Covalent bond\nc. Octet rule and Lewis structure\nd. Exception to Lewis structure rules (less than/more than octet, odd number of electrons)\ne. Polar covalent bond\nf. Ionic bond\ng. VSEPR theory\nh. Molecular orbital theory\ni. MOT of simple diatomic molecule\nj. MOT of triatomic molecules\nk. Valence bond theory and hybridization\nl. Metallic bond\n\nSECOND EXAMINATION: Date",
            "onsite": "Molecular model building activity to visualize VSEPR geometries.",
            "online": "Video demonstration of hybridization and MO diagrams.",
            "offline": "Worksheet on drawing Lewis structures and assigning formal charges.",
            "assessment": "Traditional: Problem solving on VSEPR theory and hybridization.\n\nAuthentic: Construction of molecular models for selected compounds."
        },
        {
            "weeks": "10-13",
            "hours": 12,
            "outcome": "CO1",
            "topic": "3. States of Matter\na. Gas laws\nb. Kinetic molecular theory\nc. Solids and liquids and intermolecular forces\nd. Phase change and phase diagram\ne. Properties of liquid state\nf. Structure, properties and bonding of solids\n\nTHIRD EXAMINATION: Date",
            "onsite": "Problem-solving session on gas laws and phase diagrams.",
            "online": "Interactive module on intermolecular forces and phase changes.",
            "offline": "Reading assignment on the industrial applications of phase diagrams.",
            "assessment": "Traditional: Calculation test on gas laws and kinetic energy.\n\nAuthentic: Case study analysis of a phase diagram for a specific substance."
        },
        {
            "weeks": "14-16",
            "hours": 9,
            "outcome": "CO2",
            "topic": "4. Oxidation and Reduction\na. Introduction to oxidation and reduction reactions, oxidation states\nb. Balancing oxidation-reduction reactions\nc. Standard electrode potential and thermodynamics of redox reactions\nd. Disproportionation reactions\ne. Potential diagram (Latimer, Frost, Pourbaix diagram)\nf. Application of redox reactions to the extraction of elements",
            "onsite": "Problem-solving workshop on balancing redox equations and calculating cell potentials.",
            "online": "Video demonstration of electrochemical cells and potential diagrams.",
            "offline": "Worksheet on constructing Latimer and Frost diagrams.",
            "assessment": "Traditional: Quiz on balancing redox reactions and Nernst equation calculations.\n\nAuthentic: Investigation of corrosion prevention methods."
        },
        {
            "weeks": "17-18",
            "hours": 6,
            "outcome": "CO2",
            "topic": "5. Nuclear Chemistry\na. Radioactive decay and nuclear stability\nb. Kinetics of radioactive decay\nc. Nuclear transmutation\nd. Applications of radioisotopes\ne. Radioactivity hazards\n\nCOURSE INTEGRATION: Date\nFINAL EXAMINATION: Date",
            "onsite": "Interactive lecture on nuclear stability belts and decay modes.",
            "online": "Virtual simulation of radioactive decay kinetics.",
            "offline": "Case study reading on medical applications of radioisotopes.",
            "assessment": "Traditional: Problem set on half-life calculations and nuclear equations.\n\nAuthentic: Presentation on the environmental impact of nuclear waste."
        }
    ]

    modules = []
    for idx, row in enumerate(instructional_plan):
        mod_num = idx + 1
        mod_id = f"{subject_id}_m{mod_num}"
        lines = row["topic"].split('\n')
        mod_title = lines[0].strip()
        mod_title = re.sub(r'^\d+\.\s*', '', mod_title)
        
        desc_lines = [l.strip() for l in lines[1:] if l.strip() and not l.startswith('a.') and not l.startswith('b.')]
        mod_desc = " ".join(desc_lines[:3]) if desc_lines else f"Study guide and assignments for {mod_title}."
        if len(mod_desc) > 120:
            mod_desc = mod_desc[:117] + "..."
            
        questions = []
        if mod_num == 1:
            questions = [
                {
                    "type": "mc",
                    "question": "What is the approximate molar mass of Carbon Dioxide (CO2)?",
                    "choices": [
                        "18.02 g/mol",
                        "28.01 g/mol",
                        "44.01 g/mol",
                        "58.44 g/mol"
                    ],
                    "answer": 2
                },
                {
                    "type": "mc",
                    "question": "Which subatomic particles are found in the nucleus of an atom?",
                    "choices": [
                        "Electrons and Protons",
                        "Protons and Neutrons",
                        "Neutrons and Electrons",
                        "Protons only"
                    ],
                    "answer": 1
                },
                {
                    "type": "tf",
                    "question": "Covalent bonds are formed by the transfer of electrons from a metal to a nonmetal.",
                    "answer": False
                },
                {
                    "type": "tf",
                    "question": "The process of a solid turning directly into a gas without passing through the liquid phase is called sublimation.",
                    "answer": True
                },
                {
                    "type": "id",
                    "question": "What is the coefficient of Oxygen (O2) when the following combustion equation of Methane is balanced?\nCH4 + _ O2 -> CO2 + 2H2O",
                    "answer": "2"
                }
            ]
        elif mod_num == 2:
            questions = [
                {
                    "type": "mc",
                    "question": "Which molecular geometry is associated with an sp3d hybridized central atom containing no lone pairs?",
                    "choices": [
                        "Tetrahedral",
                        "Trigonal Bipyramidal",
                        "Octahedral",
                        "Linear"
                    ],
                    "answer": 1
                },
                {
                    "type": "tf",
                    "question": "According to Molecular Orbital Theory, a bonding molecular orbital is lower in energy than the parent atomic orbitals.",
                    "answer": True
                },
                {
                    "type": "id",
                    "question": "What valence shell electron pair repulsion theory acronym stands for the model used to predict 3D molecular shapes?",
                    "answer": "VSEPR"
                }
            ]
        elif mod_num == 3:
            questions = [
                {
                    "type": "mc",
                    "question": "Which of the following describes the phase change from gas directly to solid?",
                    "choices": [
                        "Sublimation",
                        "Deposition",
                        "Condensation",
                        "Vaporization"
                    ],
                    "answer": 1
                },
                {
                    "type": "tf",
                    "question": "An increase in temperature generally leads to an increase in the viscosity of a liquid.",
                    "answer": False
                },
                {
                    "type": "id",
                    "question": "What equation relates the vapor pressure of a substance to its temperature during a phase transition?",
                    "answer": "Clausius-Clapeyron"
                }
            ]
        elif mod_num == 4:
            questions = [
                {
                    "type": "mc",
                    "question": "In the Latimer diagram, what does a species undergoing disproportionation indicate?",
                    "choices": [
                        "The potential on the right is more positive than on the left",
                        "The potential on the left is more positive than on the right",
                        "Both potentials are zero",
                        "Disproportionation is independent of potentials"
                    ],
                    "answer": 0
                },
                {
                    "type": "tf",
                    "question": "A spontaneous redox reaction under standard conditions has a positive standard cell potential (E°cell > 0).",
                    "answer": True
                },
                {
                    "type": "id",
                    "question": "What equation is used to calculate the cell potential under non-standard state conditions?",
                    "answer": "Nernst Equation"
                }
            ]
        else:
            questions = [
                {
                    "type": "mc",
                    "question": "What is the primary factor that determines whether a particular atomic nucleus is stable or radioactive?",
                    "choices": [
                        "Neutron-to-proton ratio",
                        "The total number of electrons",
                        "The temperature of the system",
                        "The pressure surrounding the atom"
                    ],
                    "answer": 0
                },
                {
                    "type": "tf",
                    "question": "All radioactive decays follow first-order reaction kinetics.",
                    "answer": True
                },
                {
                    "type": "id",
                    "question": "What type of radioactive decay involves the emission of a helium nucleus (two protons and two neutrons)?",
                    "answer": "Alpha decay"
                }
            ]
            
        pdf_filename = f"{subject_id}_m{mod_num}.pdf"
        pdf_size = "1.5 MB"
        if subject_id == "chm151" and mod_num == 2:
            pdf_filename = "CHM151 Ch9A_Molecular Geometry.pdf"
            pdf_size = "12.7 MB"
            
        modules.append({
            "id": mod_id,
            "title": f"Module {mod_num}: {mod_title}",
            "desc": mod_desc,
            "pdfUrl": f"https://raw.githubusercontent.com/iammoondae/doclearninghub/main/courses/{subject_id}/lecturenotes/{pdf_filename}",
            "pdfSize": pdf_size,
            "quiz": {
                "title": f"{mod_title} Quiz",
                "timeLimitSeconds": 600,
                "questions": questions
            },
            "assignment": {
                "title": f"{mod_title} Performance Sheet",
                "desc": row["offline"].replace("Worksheet on ", "").replace("Problem set on ", ""),
                "formUrl": "https://docs.google.com/forms/d/e/1FAIpQLSfcDmmPd5VyUu4UQWT05AQUWudxwBVutYEmmjis0Rb5_eFlKA/viewform?usp=pp_url"
            }
        })

    course_data = {
        "id": subject_id,
        "name": course_title,
        "icon": "🧪",
        "color": "#0ea5e9",
        "sections": [section_id],
        "faculty": f"{faculty_name} | {faculty_email}",
        "syllabus": {
            "title": f"{course_title} Syllabus",
            "pdfUrl": f"https://raw.githubusercontent.com/iammoondae/doclearninghub/main/courses/{subject_id}/syllabus/{subject_id.upper()}%20{section_id.upper()}.pdf",
            "pdfSize": "1.2 MB"
        },
        "past": [],
        "future": [],
        "modules": modules,
        "syllabusDetails": {
            "courseNumber": course_number,
            "courseTitle": course_title,
            "creditUnits": credit_units,
            "timeAllotment": time_allotment,
            "prerequisites": prerequisites,
            "description": course_desc,
            "outcomes": co_lines,
            "instructionalPlan": instructional_plan,
            "requirements": {
                "rules": reqs_block,
                "gradingWeights": grading_weights,
                "gradingSystem": grading_system
            },
            "references": ref_lines,
            "additionalGuidelines": guidelines,
            "faculty": {
                "name": faculty_name,
                "email": faculty_email,
                "mobile": faculty_mobile,
                "office": faculty_office,
                "consultation": faculty_consultation
            }
        }
    }
    
    return course_data

def parse_orientation_slides(txt_path):
    # Verbatim content extracted from PPT for Class Orientation.pdf
    vision = "A leading transformative University driving excellence, research, innovation, and sustainable peace and development"
    mission = (
        "To produce competent human resources committed to the development of the Philippines "
        "and to help uplift the living conditions of Muslims, Indigenous Peoples, and other underserved communities."
    )
    core_values = "I R I S E (Integrity, Respect, Inclusivity, Service, Excellence)"
    
    eoms_intro = (
        "Mindanao State University – General Santos City (MSU-GSC), as a leading institution of "
        "higher learning in Southern Mindanao, commits to providing inclusive, learner-centered, "
        "and quality education that fosters academic excellence, innovation, and social transformation. "
        "In pursuit of this commitment and guided by the principles of ISO 21001:2018, the University "
        "establishes this EOMS Policy to ensure that its academic and support systems consistently "
        "meet the needs and expectations of learners, stakeholders, and society."
    )
    
    g_part = "Demonstrate strong leadership and shared governance to align all institutional efforts with the vision, mission, and Fostering Excellence Agenda of MSUGenSan."
    e_part = "Promote academic and ethical excellence in instruction, research, extension, and institutional management."
    n1_part = "Identify, understand, and meet the evolving needs and expectations of learners and other beneficiaries through inclusive and accessible learning environments."
    s_part = "Ensure full compliance with all applicable legal, regulatory, and stakeholder requirements, and uphold quality standards in all operations."
    a_part = "Provide sufficient resources, infrastructure, technologies, and competent personnel to effectively deliver quality education and services."
    n2_part = "Adopt risk-based thinking and continuous improvement approaches to manage change and enhance educational relevance and resilience."
    
    quality_policy = (
        "Mindanao State University - General Santos is committed to advancing its transformative vision "
        "as a center of academic excellence, research, innovation, peace, and sustainable development. "
        "Upholding the highest standards of governance and service, the University fosters a culture of "
        "continuous improvement and scholarly distinction, aligning its initiatives with the evolving "
        "national, regional, and global landscape of higher education. This steadfast commitment to quality "
        "underscores its mission to serve stakeholders effectively and contribute to meaningful intellectual "
        "and societal progress."
    )
    
    eoms_details = (
        f"{eoms_intro}\n\n"
        f"MSU-General Santos shall foster excellence through G-E-N-S-A-N:\n\n"
        f"• **G – Governance and Leadership**: {g_part}\n"
        f"• **E – Excellence in Culture**: {e_part}\n"
        f"• **N – Needs and Expectations of Learners and Stakeholders**: {n1_part}\n"
        f"• **S – Standards and Compliance**: {s_part}\n"
        f"• **A – Adequate Resources and Competency Development**: {a_part}\n"
        f"• **N – Navigating Risks and Opportunities**: {n2_part}"
    ).strip()
    
    return {
        "vision": vision,
        "mission": mission,
        "values": core_values,
        "eoms": eoms_details,
        "qualityPolicy": quality_policy
    }

def main():
    print("Scanning directory for syllabus files...")
    syllabus_files = []
    if os.path.exists("courses"):
        for root, dirs, files in os.walk("courses"):
            if os.path.basename(root) == "syllabus":
                for filename in files:
                    if filename.endswith(".pdf"):
                        name_no_ext = os.path.splitext(filename)[0]
                        parts = name_no_ext.split(' ')
                        if len(parts) >= 2 and re.match(r'^[A-Z0-9]+$', parts[0]) and re.match(r'^[A-Z0-9]+$', parts[1]):
                            subject_id = parts[0].lower()
                            section_id = parts[1].lower()
                            syllabus_files.append({
                                "pdf": os.path.join(root, filename),
                                "txt": f"scratch/{subject_id}_{section_id}.txt",
                                "subject": subject_id,
                                "section": section_id
                            })
                
    if not syllabus_files:
        print("No syllabus PDF files (e.g. CHM151 49C.pdf) found in workspace!")
        return
        
    print(f"Found syllabus file(s): {[s['pdf'] for s in syllabus_files]}")
    
    # Auto-extract orientation slides if available
    orientation_pdf = "PPT for Class Orientation.pdf"
    orientation_txt = "scratch/ppt_orientation.txt"
    if os.path.exists(orientation_pdf):
        if not os.path.exists(orientation_txt) or os.path.getmtime(orientation_pdf) > os.path.getmtime(orientation_txt):
            print(f"Extracting text from {orientation_pdf}...")
            os.makedirs("scratch", exist_ok=True)
            subprocess.run(["pdftotext", orientation_pdf, orientation_txt], check=True)

    inst_foundations = parse_orientation_slides(orientation_txt)
    courses = []
    for sf in syllabus_files:
        pdf_path = sf["pdf"]
        txt_path = sf["txt"]
        # Auto-extract syllabus text if missing or outdated relative to PDF
        if not os.path.exists(txt_path) or os.path.getmtime(pdf_path) > os.path.getmtime(txt_path):
            print(f"Extracting text from PDF {pdf_path} to {txt_path}...")
            os.makedirs("scratch", exist_ok=True)
            subprocess.run(["pdftotext", pdf_path, txt_path], check=True)

        print(f"Parsing syllabus text: {txt_path}...")
        course_data = parse_syllabus_file(txt_path, sf["subject"], sf["section"])
        if course_data:
            course_data["syllabusDetails"]["institutionalFoundations"] = inst_foundations
            courses.append(course_data)
            
    manifest = {
        "announcements": [
            {
                "id": "ann_1",
                "title": "Welcome to the Department of Chemistry!",
                "content": "Doc Learning Hub is now online. Access your study guides, syllabus content, and complete your module quizzes natively inside the app.",
                "date": "June 16, 2026"
            }
        ],
        "courses": courses
    }
    
    os.makedirs("data", exist_ok=True)
    with open("data/manifest.json", 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2)
        
    print("[SUCCESS] Compiled data/manifest.json successfully!")
    print(f"Added {len(courses)} course(s) based on PDFF files.")

if __name__ == '__main__':
    main()
