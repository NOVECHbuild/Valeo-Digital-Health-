// Clinical Assessment Library
// All instruments here are verified public domain or freely available for clinical use.
// PHQ-9 & GAD-7: Pfizer public domain
// PCL-5: US National Center for PTSD (public domain)
// ASRS v1.1: World Health Organization (free for clinical use)
// PSS-10: Sheldon Cohen (free for non-commercial clinical use)
// HDRS-17 (HAM-D): Public domain (Max Hamilton, 1960)
// PID-5 Brief: American Psychological Association (free for clinical use)

export type QuestionType = "multiChoice" | "scale" | "text" | "textarea" | "yesNo";

export interface ScoredQuestion {
  id:       string;
  type:     QuestionType;
  label:    string;
  required: boolean;
  options?: string[];         // display labels
  optionScores?: number[];    // parallel array — score for each option
  reverse?: boolean;          // reverse-scored item
}

export interface ScoreRange {
  min:         number;
  max:         number;
  label:       string;
  color:       string;
  description: string;
}

export interface SystemTemplate {
  id:               string;
  title:            string;
  shortName:        string;
  category:         "Mood" | "Anxiety" | "Trauma" | "ADHD" | "Stress" | "Personality" | "Cognitive";
  description:      string;
  instructions:     string;
  estimatedMinutes: number;
  questions:        ScoredQuestion[];
  scoring: {
    maxScore:     number;
    ranges:       ScoreRange[];
    notes?:       string;    // clinical notes shown to doctor only
  };
  isSystem:         true;
  reference:        string;
}

// ─── PHQ-9 ────────────────────────────────────────────────────────────────────
const PHQ9_OPTIONS    = ["Not at all", "Several days", "More than half the days", "Nearly every day"];
const PHQ9_SCORES     = [0, 1, 2, 3];

export const PHQ9: SystemTemplate = {
  id:               "system_phq9",
  title:            "Patient Health Questionnaire-9 (PHQ-9)",
  shortName:        "PHQ-9",
  category:         "Mood",
  description:      "9-item validated screening tool for depression severity.",
  instructions:     "Over the last 2 weeks, how often have you been bothered by any of the following problems?",
  estimatedMinutes: 3,
  isSystem:         true,
  reference:        "Kroenke K, Spitzer RL, Williams JBW. The PHQ-9. J Gen Intern Med. 2001. Public domain.",
  questions: [
    { id:"phq9_1", type:"multiChoice", label:"Little interest or pleasure in doing things",                                                                                                                                                     required:true, options:PHQ9_OPTIONS, optionScores:PHQ9_SCORES },
    { id:"phq9_2", type:"multiChoice", label:"Feeling down, depressed, or hopeless",                                                                                                                                                           required:true, options:PHQ9_OPTIONS, optionScores:PHQ9_SCORES },
    { id:"phq9_3", type:"multiChoice", label:"Trouble falling or staying asleep, or sleeping too much",                                                                                                                                         required:true, options:PHQ9_OPTIONS, optionScores:PHQ9_SCORES },
    { id:"phq9_4", type:"multiChoice", label:"Feeling tired or having little energy",                                                                                                                                                           required:true, options:PHQ9_OPTIONS, optionScores:PHQ9_SCORES },
    { id:"phq9_5", type:"multiChoice", label:"Poor appetite or overeating",                                                                                                                                                                     required:true, options:PHQ9_OPTIONS, optionScores:PHQ9_SCORES },
    { id:"phq9_6", type:"multiChoice", label:"Feeling bad about yourself — or that you are a failure or have let yourself or your family down",                                                                                                 required:true, options:PHQ9_OPTIONS, optionScores:PHQ9_SCORES },
    { id:"phq9_7", type:"multiChoice", label:"Trouble concentrating on things, such as reading or watching television",                                                                                                                         required:true, options:PHQ9_OPTIONS, optionScores:PHQ9_SCORES },
    { id:"phq9_8", type:"multiChoice", label:"Moving or speaking so slowly that other people could have noticed — or being so fidgety or restless that you have been moving around a lot more than usual",                                      required:true, options:PHQ9_OPTIONS, optionScores:PHQ9_SCORES },
    { id:"phq9_9", type:"multiChoice", label:"Thoughts that you would be better off dead, or thoughts of hurting yourself in some way",                                                                                                         required:true, options:PHQ9_OPTIONS, optionScores:PHQ9_SCORES },
  ],
  scoring: {
    maxScore: 27,
    notes: "Item 9 (suicidal ideation) should always be reviewed regardless of total score. Any score ≥ 1 on item 9 warrants clinical follow-up.",
    ranges: [
      { min:0,  max:4,  label:"Minimal depression",          color:"#6BA028", description:"Minimal or no depressive symptoms. Monitor and reassess as needed." },
      { min:5,  max:9,  label:"Mild depression",             color:"#8DC63F", description:"Mild symptoms. Watchful waiting; repeat PHQ-9 at follow-up." },
      { min:10, max:14, label:"Moderate depression",         color:"#F7941D", description:"Treatment plan, considering counselling and/or pharmacotherapy." },
      { min:15, max:19, label:"Moderately severe depression",color:"#F7941D", description:"Active treatment with pharmacotherapy and/or psychotherapy." },
      { min:20, max:27, label:"Severe depression",           color:"#C0392B", description:"Immediate initiation of pharmacotherapy and referral to specialist." },
    ],
  },
};

// ─── GAD-7 ────────────────────────────────────────────────────────────────────
const GAD7_OPTIONS = ["Not at all", "Several days", "More than half the days", "Nearly every day"];
const GAD7_SCORES  = [0, 1, 2, 3];

export const GAD7: SystemTemplate = {
  id:               "system_gad7",
  title:            "Generalized Anxiety Disorder-7 (GAD-7)",
  shortName:        "GAD-7",
  category:         "Anxiety",
  description:      "7-item validated screening tool for generalised anxiety disorder severity.",
  instructions:     "Over the last 2 weeks, how often have you been bothered by the following problems?",
  estimatedMinutes: 2,
  isSystem:         true,
  reference:        "Spitzer RL, et al. A Brief Measure for Assessing GAD. Arch Intern Med. 2006. Public domain.",
  questions: [
    { id:"gad7_1", type:"multiChoice", label:"Feeling nervous, anxious, or on edge",                               required:true, options:GAD7_OPTIONS, optionScores:GAD7_SCORES },
    { id:"gad7_2", type:"multiChoice", label:"Not being able to stop or control worrying",                          required:true, options:GAD7_OPTIONS, optionScores:GAD7_SCORES },
    { id:"gad7_3", type:"multiChoice", label:"Worrying too much about different things",                            required:true, options:GAD7_OPTIONS, optionScores:GAD7_SCORES },
    { id:"gad7_4", type:"multiChoice", label:"Trouble relaxing",                                                    required:true, options:GAD7_OPTIONS, optionScores:GAD7_SCORES },
    { id:"gad7_5", type:"multiChoice", label:"Being so restless that it is hard to sit still",                      required:true, options:GAD7_OPTIONS, optionScores:GAD7_SCORES },
    { id:"gad7_6", type:"multiChoice", label:"Becoming easily annoyed or irritable",                                required:true, options:GAD7_OPTIONS, optionScores:GAD7_SCORES },
    { id:"gad7_7", type:"multiChoice", label:"Feeling afraid as if something awful might happen",                   required:true, options:GAD7_OPTIONS, optionScores:GAD7_SCORES },
  ],
  scoring: {
    maxScore: 21,
    ranges: [
      { min:0,  max:4,  label:"Minimal anxiety",  color:"#6BA028", description:"Minimal anxiety symptoms. Consider monitoring." },
      { min:5,  max:9,  label:"Mild anxiety",     color:"#8DC63F", description:"Mild anxiety. Self-help strategies may be appropriate." },
      { min:10, max:14, label:"Moderate anxiety", color:"#F7941D", description:"Consider further evaluation and possible treatment." },
      { min:15, max:21, label:"Severe anxiety",   color:"#F7941D", description:"Active treatment strongly recommended." },
    ],
  },
};

// ─── PCL-5 ────────────────────────────────────────────────────────────────────
const PCL5_OPTIONS = ["Not at all", "A little bit", "Moderately", "Quite a bit", "Extremely"];
const PCL5_SCORES  = [0, 1, 2, 3, 4];

export const PCL5: SystemTemplate = {
  id:               "system_pcl5",
  title:            "PTSD Checklist for DSM-5 (PCL-5)",
  shortName:        "PCL-5",
  category:         "Trauma",
  description:      "20-item self-report measure for PTSD symptoms aligned with DSM-5 criteria.",
  instructions:     "Below is a list of problems that people sometimes have in response to a very stressful experience. Please read each problem carefully and then indicate how much you have been bothered by that problem in the past month.",
  estimatedMinutes: 7,
  isSystem:         true,
  reference:        "Weathers et al. (2013). National Center for PTSD. Public domain.",
  questions: [
    { id:"pcl5_1",  type:"multiChoice", label:"Repeated, disturbing, and unwanted memories of the stressful experience",                                                    required:true, options:PCL5_OPTIONS, optionScores:PCL5_SCORES },
    { id:"pcl5_2",  type:"multiChoice", label:"Repeated, disturbing dreams of the stressful experience",                                                                    required:true, options:PCL5_OPTIONS, optionScores:PCL5_SCORES },
    { id:"pcl5_3",  type:"multiChoice", label:"Suddenly feeling or acting as if the stressful experience were actually happening again (as if you were actually back there reliving it)", required:true, options:PCL5_OPTIONS, optionScores:PCL5_SCORES },
    { id:"pcl5_4",  type:"multiChoice", label:"Feeling very upset when something reminded you of the stressful experience",                                                  required:true, options:PCL5_OPTIONS, optionScores:PCL5_SCORES },
    { id:"pcl5_5",  type:"multiChoice", label:"Having strong physical reactions when something reminded you of the stressful experience (e.g. heart pounding, trouble breathing, sweating)", required:true, options:PCL5_OPTIONS, optionScores:PCL5_SCORES },
    { id:"pcl5_6",  type:"multiChoice", label:"Avoiding memories, thoughts, or feelings related to the stressful experience",                                                required:true, options:PCL5_OPTIONS, optionScores:PCL5_SCORES },
    { id:"pcl5_7",  type:"multiChoice", label:"Avoiding external reminders of the stressful experience (people, places, conversations, activities, objects, or situations)", required:true, options:PCL5_OPTIONS, optionScores:PCL5_SCORES },
    { id:"pcl5_8",  type:"multiChoice", label:"Trouble remembering important parts of the stressful experience",                                                             required:true, options:PCL5_OPTIONS, optionScores:PCL5_SCORES },
    { id:"pcl5_9",  type:"multiChoice", label:"Having strong negative beliefs about yourself, other people, or the world",                                                   required:true, options:PCL5_OPTIONS, optionScores:PCL5_SCORES },
    { id:"pcl5_10", type:"multiChoice", label:"Blaming yourself or someone else for the stressful experience or what happened after it",                                     required:true, options:PCL5_OPTIONS, optionScores:PCL5_SCORES },
    { id:"pcl5_11", type:"multiChoice", label:"Having strong negative feelings such as fear, horror, anger, guilt, or shame",                                                required:true, options:PCL5_OPTIONS, optionScores:PCL5_SCORES },
    { id:"pcl5_12", type:"multiChoice", label:"Loss of interest in activities that you used to enjoy",                                                                       required:true, options:PCL5_OPTIONS, optionScores:PCL5_SCORES },
    { id:"pcl5_13", type:"multiChoice", label:"Feeling distant or cut off from other people",                                                                                required:true, options:PCL5_OPTIONS, optionScores:PCL5_SCORES },
    { id:"pcl5_14", type:"multiChoice", label:"Trouble experiencing positive feelings (e.g. being unable to feel happiness or love for people close to you)",                required:true, options:PCL5_OPTIONS, optionScores:PCL5_SCORES },
    { id:"pcl5_15", type:"multiChoice", label:"Irritable behaviour, angry outbursts, or acting aggressively",                                                                required:true, options:PCL5_OPTIONS, optionScores:PCL5_SCORES },
    { id:"pcl5_16", type:"multiChoice", label:"Taking too many risks or doing things that could cause you harm",                                                             required:true, options:PCL5_OPTIONS, optionScores:PCL5_SCORES },
    { id:"pcl5_17", type:"multiChoice", label:"Being 'super-alert' or watchful or on guard",                                                                                 required:true, options:PCL5_OPTIONS, optionScores:PCL5_SCORES },
    { id:"pcl5_18", type:"multiChoice", label:"Feeling jumpy or easily startled",                                                                                            required:true, options:PCL5_OPTIONS, optionScores:PCL5_SCORES },
    { id:"pcl5_19", type:"multiChoice", label:"Having difficulty concentrating",                                                                                              required:true, options:PCL5_OPTIONS, optionScores:PCL5_SCORES },
    { id:"pcl5_20", type:"multiChoice", label:"Trouble falling or staying asleep",                                                                                           required:true, options:PCL5_OPTIONS, optionScores:PCL5_SCORES },
  ],
  scoring: {
    maxScore: 80,
    notes: "A provisional PTSD diagnosis can be made by assigning symptoms to DSM-5 criteria and checking that each criterion is met. A score of 31–33 or above is commonly used as a cutoff for probable PTSD.",
    ranges: [
      { min:0,  max:30, label:"Below PTSD threshold",  color:"#6BA028", description:"Symptoms below the threshold commonly used for probable PTSD. Monitor and reassess." },
      { min:31, max:80, label:"Probable PTSD",         color:"#F7941D", description:"Score meets or exceeds the commonly used threshold (31–33) for probable PTSD. Further clinical evaluation and DSM-5 criteria review recommended." },
    ],
  },
};

// ─── ASRS v1.1 (Part A) ───────────────────────────────────────────────────────
const ASRS_OPTIONS = ["Never", "Rarely", "Sometimes", "Often", "Very Often"];
const ASRS_SCORES  = [0, 1, 2, 3, 4];

export const ASRS: SystemTemplate = {
  id:               "system_asrs",
  title:            "Adult ADHD Self-Report Scale (ASRS v1.1) — Part A",
  shortName:        "ASRS",
  category:         "ADHD",
  description:      "6-item WHO-validated screener for adult ADHD. Part A alone has high sensitivity and specificity.",
  instructions:     "Please answer the questions below, rating yourself on each of the criteria shown using the scale provided. As you answer each question, select the column that best describes how you have felt and conducted yourself over the past 6 months.",
  estimatedMinutes: 3,
  isSystem:         true,
  reference:        "Kessler RC, et al. World Health Organization Adult ADHD Self-Report Scale. Psychol Med. 2005. Free for clinical use.",
  questions: [
    { id:"asrs_1", type:"multiChoice", label:"How often do you have trouble wrapping up the final details of a project, once the challenging parts have been done?",                                                  required:true, options:ASRS_OPTIONS, optionScores:ASRS_SCORES },
    { id:"asrs_2", type:"multiChoice", label:"How often do you have difficulty getting things in order when you have to do a task that requires organisation?",                                                       required:true, options:ASRS_OPTIONS, optionScores:ASRS_SCORES },
    { id:"asrs_3", type:"multiChoice", label:"How often do you have problems remembering appointments or obligations?",                                                                                              required:true, options:ASRS_OPTIONS, optionScores:ASRS_SCORES },
    { id:"asrs_4", type:"multiChoice", label:"When you have a task that requires a lot of thought, how often do you avoid or delay getting started?",                                                               required:true, options:ASRS_OPTIONS, optionScores:ASRS_SCORES },
    { id:"asrs_5", type:"multiChoice", label:"How often do you fidget or squirm with your hands or feet when you have to sit down for a long time?",                                                               required:true, options:ASRS_OPTIONS, optionScores:ASRS_SCORES },
    { id:"asrs_6", type:"multiChoice", label:"How often do you feel overly active and compelled to do things, like you were driven by a motor?",                                                                   required:true, options:ASRS_OPTIONS, optionScores:ASRS_SCORES },
  ],
  scoring: {
    maxScore: 20,
    notes: "ASRS scoring uses a shading method rather than a simple sum. Q1–Q4: 'Sometimes', 'Often', or 'Very Often' = positive. Q5–Q6: 'Often' or 'Very Often' = positive. 4 or more positives = highly consistent with ADHD. The total score displayed here is a sum for reference; apply the shading method clinically.",
    ranges: [
      { min:0,  max:11, label:"Unlikely ADHD",  color:"#6BA028", description:"Scores suggest ADHD symptoms are unlikely. Use clinical judgment." },
      { min:12, max:20, label:"Consistent with ADHD", color:"#F7941D", description:"Scores are highly consistent with ADHD in adults. Full diagnostic evaluation recommended." },
    ],
  },
};

// ─── PSS-10 ───────────────────────────────────────────────────────────────────
const PSS_OPTIONS = ["Never", "Almost Never", "Sometimes", "Fairly Often", "Very Often"];
const PSS_SCORES  = [0, 1, 2, 3, 4];
const PSS_SCORES_R = [4, 3, 2, 1, 0]; // reverse-scored items

export const PSS: SystemTemplate = {
  id:               "system_pss",
  title:            "Perceived Stress Scale (PSS-10)",
  shortName:        "PSS-10",
  category:         "Stress",
  description:      "10-item scale measuring the degree to which situations in one's life are appraised as stressful.",
  instructions:     "The questions in this scale ask you about your feelings and thoughts during the last month. In each case, you will be asked to indicate how often you felt or thought a certain way. Although some of the questions are similar, there are differences between them and you should treat each one as a separate question. The best approach is to answer fairly quickly.",
  estimatedMinutes: 3,
  isSystem:         true,
  reference:        "Cohen S, Kamarck T, Mermelstein R. A global measure of perceived stress. J Health Soc Behav. 1983. Free for non-commercial clinical use.",
  questions: [
    { id:"pss_1",  type:"multiChoice", label:"In the last month, how often have you been upset because of something that happened unexpectedly?",                          required:true, options:PSS_OPTIONS, optionScores:PSS_SCORES },
    { id:"pss_2",  type:"multiChoice", label:"In the last month, how often have you felt that you were unable to control the important things in your life?",              required:true, options:PSS_OPTIONS, optionScores:PSS_SCORES },
    { id:"pss_3",  type:"multiChoice", label:"In the last month, how often have you felt nervous and stressed?",                                                          required:true, options:PSS_OPTIONS, optionScores:PSS_SCORES },
    { id:"pss_4",  type:"multiChoice", label:"In the last month, how often have you felt confident about your ability to handle your personal problems?",                  required:true, options:PSS_OPTIONS, optionScores:PSS_SCORES_R, reverse:true },
    { id:"pss_5",  type:"multiChoice", label:"In the last month, how often have you felt that things were going your way?",                                               required:true, options:PSS_OPTIONS, optionScores:PSS_SCORES_R, reverse:true },
    { id:"pss_6",  type:"multiChoice", label:"In the last month, how often have you been able to control irritations in your life?",                                       required:true, options:PSS_OPTIONS, optionScores:PSS_SCORES },
    { id:"pss_7",  type:"multiChoice", label:"In the last month, how often have you felt that you were on top of things?",                                                required:true, options:PSS_OPTIONS, optionScores:PSS_SCORES_R, reverse:true },
    { id:"pss_8",  type:"multiChoice", label:"In the last month, how often have you been angered because of things that happened that were outside of your control?",     required:true, options:PSS_OPTIONS, optionScores:PSS_SCORES },
    { id:"pss_9",  type:"multiChoice", label:"In the last month, how often have you felt difficulties were piling up so high that you could not overcome them?",          required:true, options:PSS_OPTIONS, optionScores:PSS_SCORES },
    { id:"pss_10", type:"multiChoice", label:"In the last month, how often have you been able to control the way you spend your time?",                                   required:true, options:PSS_OPTIONS, optionScores:PSS_SCORES_R, reverse:true },
  ],
  scoring: {
    maxScore: 40,
    notes: "Items 4, 5, 7, and 10 are reverse-scored (marked with reverse:true). The score displayed has already applied reverse scoring. Higher scores indicate higher perceived stress.",
    ranges: [
      { min:0,  max:13, label:"Low stress",      color:"#6BA028", description:"Low perceived stress. Psychoeducation and wellness strategies may be appropriate." },
      { min:14, max:26, label:"Moderate stress", color:"#F7941D", description:"Moderate stress. Stress management interventions may be beneficial." },
      { min:27, max:40, label:"High stress",     color:"#F7941D", description:"High perceived stress. Clinical attention recommended; consider comprehensive evaluation." },
    ],
  },
};

// ─── HDRS-17 (HAM-D) ─────────────────────────────────────────────────────────
// HAM-D is clinician-administered. Items have varying anchor options.
// Adapted here for clinician self-report entry during/after interview.
export const HAMD: SystemTemplate = {
  id:               "system_hamd",
  title:            "Hamilton Depression Rating Scale (HDRS-17)",
  shortName:        "HAM-D",
  category:         "Mood",
  description:      "17-item clinician-administered scale for rating depression severity. Complete this after your clinical interview with the client.",
  instructions:     "This scale is completed by the clinician based on a structured clinical interview. Rate each item according to the severity observed/reported. Do not share this form with the client — it is for clinician record only.",
  estimatedMinutes: 20,
  isSystem:         true,
  reference:        "Hamilton M. A rating scale for depression. J Neurol Neurosurg Psychiatry. 1960. Public domain.",
  questions: [
    { id:"hamd_1",  type:"multiChoice", label:"Depressed mood (sadness, hopeless, helpless, worthless)",                                       required:true, options:["Absent","These feeling states indicated only on questioning","These feeling states spontaneously reported verbally","Communicates feeling states non-verbally","Patient reports virtually only these feeling states in spontaneous verbal and non-verbal communication"], optionScores:[0,1,2,3,4] },
    { id:"hamd_2",  type:"multiChoice", label:"Feelings of guilt",                                                                              required:true, options:["Absent","Self-reproach, feels they have let people down","Ideas of guilt or rumination over past errors","Present illness is a punishment. Delusions of guilt","Hears accusatory or denunciatory voices and/or experiences threatening visual hallucinations"], optionScores:[0,1,2,3,4] },
    { id:"hamd_3",  type:"multiChoice", label:"Suicide",                                                                                        required:true, options:["Absent","Feels life is not worth living","Wishes they were dead or any thoughts of possible death to self","Suicidal ideas or gesture","Attempts at suicide (any serious attempt rates 4)"], optionScores:[0,1,2,3,4] },
    { id:"hamd_4",  type:"multiChoice", label:"Insomnia early (difficulty falling asleep)",                                                     required:true, options:["No difficulty falling asleep","Complains of occasional difficulty falling asleep","Complains of nightly difficulty falling asleep"], optionScores:[0,1,2] },
    { id:"hamd_5",  type:"multiChoice", label:"Insomnia middle (waking during the night)",                                                      required:true, options:["No difficulty","Patient complains of being restless and disturbed during the night","Waking during the night — any getting out of bed rates 2 (except for purpose of voiding)"], optionScores:[0,1,2] },
    { id:"hamd_6",  type:"multiChoice", label:"Insomnia late (early morning awakening)",                                                        required:true, options:["No difficulty","Waking in early hours of the morning but goes back to sleep","Unable to fall asleep again if gets out of bed"], optionScores:[0,1,2] },
    { id:"hamd_7",  type:"multiChoice", label:"Work and activities",                                                                            required:true, options:["No difficulty","Thoughts and feelings of incapacity, fatigue or weakness related to activities (work or hobbies)","Loss of interest in activities (hobbies or work) — either directly reported or inferred","Decrease in actual time spent in activities or decrease in productivity","Stopped working because of present illness"], optionScores:[0,1,2,3,4] },
    { id:"hamd_8",  type:"multiChoice", label:"Psychomotor retardation (slowness of thought, speech, impaired ability to concentrate, decreased motor activity)", required:true, options:["Normal speech and thought","Slight retardation at interview","Obvious retardation at interview","Interview difficult","Complete stupor"], optionScores:[0,1,2,3,4] },
    { id:"hamd_9",  type:"multiChoice", label:"Agitation",                                                                                      required:true, options:["None","Fidgetiness","Playing with hands, hair, etc.","Moving about, can't sit still","Hand wringing, nail biting, hair pulling, biting of lips"], optionScores:[0,1,2,3,4] },
    { id:"hamd_10", type:"multiChoice", label:"Anxiety (psychological)",                                                                        required:true, options:["No difficulty","Subjective tension and irritability","Worrying about minor matters","Apprehensive attitude apparent in face or speech","Fears expressed without questioning"], optionScores:[0,1,2,3,4] },
    { id:"hamd_11", type:"multiChoice", label:"Anxiety (somatic) — physiological concomitants of anxiety",                                     required:true, options:["Absent","Mild","Moderate","Severe","Incapacitating"], optionScores:[0,1,2,3,4] },
    { id:"hamd_12", type:"multiChoice", label:"Somatic symptoms (gastrointestinal)",                                                            required:true, options:["None","Loss of appetite but eating without encouragement","Difficulty eating without urging; requests or requires laxatives or medication for bowels or medication for GI symptoms"], optionScores:[0,1,2] },
    { id:"hamd_13", type:"multiChoice", label:"Somatic symptoms (general)",                                                                     required:true, options:["None","Heaviness in limbs, back or head; backaches, headache, muscle aches; loss of energy and fatigability","Any clear-cut symptom rates 2"], optionScores:[0,1,2] },
    { id:"hamd_14", type:"multiChoice", label:"Genital symptoms (symptoms such as loss of libido, menstrual disturbances)",                    required:true, options:["Absent","Mild","Severe"], optionScores:[0,1,2] },
    { id:"hamd_15", type:"multiChoice", label:"Hypochondriasis",                                                                                required:true, options:["Not present","Self-absorption (bodily)","Preoccupation with health","Frequent complaints, requests for help, etc.","Hypochondriacal delusions"], optionScores:[0,1,2,3,4] },
    { id:"hamd_16", type:"multiChoice", label:"Loss of weight (rate either A or B; A = history, B = observed)",                               required:true, options:["No weight loss","Probable weight loss associated with present illness","Definite (according to patient) weight loss","Not assessed"], optionScores:[0,1,2,0] },
    { id:"hamd_17", type:"multiChoice", label:"Insight",                                                                                        required:true, options:["Acknowledges being depressed and ill","Acknowledges illness but attributes cause to bad food, climate, overwork, virus, need for rest, etc.","Denies being ill at all"], optionScores:[0,1,2] },
  ],
  scoring: {
    maxScore: 52,
    notes: "The HAM-D is clinician-rated and should be completed after a structured interview. It is not a self-report instrument. Total score interpretation below. Note: Item 16 option 'Not assessed' scores 0.",
    ranges: [
      { min:0,  max:7,  label:"Normal / no depression",    color:"#6BA028", description:"No significant depressive symptoms." },
      { min:8,  max:13, label:"Mild depression",           color:"#8DC63F", description:"Mild depressive symptoms." },
      { min:14, max:18, label:"Mild to moderate",          color:"#F7941D", description:"Mild to moderate depression." },
      { min:19, max:22, label:"Moderate to severe",        color:"#F7941D", description:"Moderate to severe depression. Active treatment recommended." },
      { min:23, max:52, label:"Very severe depression",    color:"#C0392B", description:"Very severe depression. Urgent intervention may be required." },
    ],
  },
};

// ─── PID-5 Brief ─────────────────────────────────────────────────────────────
const PID5_OPTIONS = [
  "Very False or Often False",
  "Sometimes or Somewhat False",
  "Sometimes or Somewhat True",
  "Very True or Often True",
];
const PID5_SCORES = [0, 1, 2, 3];

export const PID5: SystemTemplate = {
  id:               "system_pid5",
  title:            "Personality Inventory for DSM-5 — Brief Form (PID-5-BF)",
  shortName:        "PID-5-BF",
  category:         "Personality",
  description:      "25-item self-report inventory assessing DSM-5 personality trait domains: Negative Affect, Detachment, Antagonism, Disinhibition, and Psychoticism.",
  instructions:     "This questionnaire asks you to describe yourself — what you are like most of the time. Please read each statement and indicate how well it describes you using the scale provided. There are no right or wrong answers. Take your time and answer honestly.",
  estimatedMinutes: 8,
  isSystem:         true,
  reference:        "Krueger RF, et al. APA DSM-5 Personality Inventory (PID-5). 2012. Free for clinical use — APA.",
  questions: [
    // Negative Affect (5 items)
    { id:"pid5_1",  type:"multiChoice", label:"Emotional experiences are intense and powerful.",                                                  required:true, options:PID5_OPTIONS, optionScores:PID5_SCORES },
    { id:"pid5_2",  type:"multiChoice", label:"I worry about almost everything.",                                                                 required:true, options:PID5_OPTIONS, optionScores:PID5_SCORES },
    { id:"pid5_3",  type:"multiChoice", label:"I am never satisfied with what I have.",                                                           required:true, options:PID5_OPTIONS, optionScores:PID5_SCORES },
    { id:"pid5_4",  type:"multiChoice", label:"I often feel like nothing I do really matters.",                                                   required:true, options:PID5_OPTIONS, optionScores:PID5_SCORES },
    { id:"pid5_5",  type:"multiChoice", label:"I get emotional easily, often for very little reason.",                                            required:true, options:PID5_OPTIONS, optionScores:PID5_SCORES },
    // Detachment (5 items)
    { id:"pid5_6",  type:"multiChoice", label:"I don't like to get too close to people.",                                                         required:true, options:PID5_OPTIONS, optionScores:PID5_SCORES },
    { id:"pid5_7",  type:"multiChoice", label:"I rarely enjoy life.",                                                                             required:true, options:PID5_OPTIONS, optionScores:PID5_SCORES },
    { id:"pid5_8",  type:"multiChoice", label:"I don't get the point of doing things for other people.",                                          required:true, options:PID5_OPTIONS, optionScores:PID5_SCORES },
    { id:"pid5_9",  type:"multiChoice", label:"I prefer being alone to having close friends.",                                                    required:true, options:PID5_OPTIONS, optionScores:PID5_SCORES },
    { id:"pid5_10", type:"multiChoice", label:"I find it hard to get emotionally close to other people.",                                         required:true, options:PID5_OPTIONS, optionScores:PID5_SCORES },
    // Antagonism (5 items)
    { id:"pid5_11", type:"multiChoice", label:"It's easy for me to take advantage of others.",                                                    required:true, options:PID5_OPTIONS, optionScores:PID5_SCORES },
    { id:"pid5_12", type:"multiChoice", label:"I use people to get what I want.",                                                                 required:true, options:PID5_OPTIONS, optionScores:PID5_SCORES },
    { id:"pid5_13", type:"multiChoice", label:"I'll say anything to get what I want.",                                                            required:true, options:PID5_OPTIONS, optionScores:PID5_SCORES },
    { id:"pid5_14", type:"multiChoice", label:"I enjoy making people in control look stupid.",                                                    required:true, options:PID5_OPTIONS, optionScores:PID5_SCORES },
    { id:"pid5_15", type:"multiChoice", label:"People would describe me as reckless.",                                                            required:true, options:PID5_OPTIONS, optionScores:PID5_SCORES },
    // Disinhibition (5 items)
    { id:"pid5_16", type:"multiChoice", label:"I act totally on impulse.",                                                                        required:true, options:PID5_OPTIONS, optionScores:PID5_SCORES },
    { id:"pid5_17", type:"multiChoice", label:"Even though I know better, I can't stop making rash decisions.",                                   required:true, options:PID5_OPTIONS, optionScores:PID5_SCORES },
    { id:"pid5_18", type:"multiChoice", label:"I make promises that I don't really intend to keep.",                                              required:true, options:PID5_OPTIONS, optionScores:PID5_SCORES },
    { id:"pid5_19", type:"multiChoice", label:"I'm not good at planning ahead.",                                                                  required:true, options:PID5_OPTIONS, optionScores:PID5_SCORES },
    { id:"pid5_20", type:"multiChoice", label:"I often make mistakes because I don't think before I act.",                                        required:true, options:PID5_OPTIONS, optionScores:PID5_SCORES },
    // Psychoticism (5 items)
    { id:"pid5_21", type:"multiChoice", label:"I often have thoughts that make sense to me but that other people say are strange.",               required:true, options:PID5_OPTIONS, optionScores:PID5_SCORES },
    { id:"pid5_22", type:"multiChoice", label:"I see things other people don't see.",                                                             required:true, options:PID5_OPTIONS, optionScores:PID5_SCORES },
    { id:"pid5_23", type:"multiChoice", label:"I often have thoughts that I know are not real but still scare me.",                               required:true, options:PID5_OPTIONS, optionScores:PID5_SCORES },
    { id:"pid5_24", type:"multiChoice", label:"I believe in things that most people think are crazy.",                                            required:true, options:PID5_OPTIONS, optionScores:PID5_SCORES },
    { id:"pid5_25", type:"multiChoice", label:"I have a very clear sense of things that other people can't see.",                                 required:true, options:PID5_OPTIONS, optionScores:PID5_SCORES },
  ],
  scoring: {
    maxScore: 75,
    notes: `Domain scores (average of 5 items each, 0–3):
• Negative Affect: Q1–Q5
• Detachment: Q6–Q10
• Antagonism: Q11–Q15
• Disinhibition: Q16–Q20
• Psychoticism: Q21–Q25

Total score and domain averages are shown below. Higher scores within a domain indicate greater pathological trait expression. No single cut-off defines a personality disorder — interpret in full clinical context.`,
    ranges: [
      { min:0,  max:25, label:"Low trait expression",      color:"#6BA028", description:"Low overall personality trait pathology across domains." },
      { min:26, max:50, label:"Moderate trait expression", color:"#F7941D", description:"Moderate pathological trait expression. Review domain scores individually." },
      { min:51, max:75, label:"High trait expression",     color:"#F7941D", description:"Elevated pathological trait expression across multiple domains. Comprehensive personality evaluation recommended." },
    ],
  },
};

// ─── Export all ───────────────────────────────────────────────────────────────
export const SYSTEM_TEMPLATES: SystemTemplate[] = [PHQ9, GAD7, PCL5, ASRS, PSS, HAMD, PID5];

export const CATEGORY_COLORS: Record<string, { bg: string; color: string }> = {
  Mood:        { bg:"rgba(141,198,63,0.12)",  color:"#6BA028" },
  Anxiety:     { bg:"rgba(247,148,29,0.12)",  color:"#C4700A" },
  Trauma:      { bg:"rgba(247,148,29,0.12)",   color:"#F7941D" },
  ADHD:        { bg:"rgba(52,152,219,0.12)",  color:"#2980B9" },
  Stress:      { bg:"rgba(142,68,173,0.12)",  color:"#8E44AD" },
  Personality: { bg:"rgba(42,74,26,0.1)",     color:"#2A4A1A" },
  Cognitive:   { bg:"rgba(46,204,113,0.12)",  color:"#27AE60" },
};

// Calculate total score from responses + question scoring metadata
export function calculateScore(
  questions: ScoredQuestion[],
  responses: Record<string, string | number>
): number {
  let total = 0;
  questions.forEach(q => {
    const response = responses[q.id];
    if (response === undefined || response === "") return;
    if (q.optionScores && q.options) {
      const idx = q.options.indexOf(response as string);
      if (idx !== -1) total += q.optionScores[idx];
    }
  });
  return total;
}

// Get PID-5 domain scores
export function getPID5DomainScores(responses: Record<string, string | number>): Record<string, number> {
  const domains = {
    "Negative Affect": ["pid5_1","pid5_2","pid5_3","pid5_4","pid5_5"],
    "Detachment":      ["pid5_6","pid5_7","pid5_8","pid5_9","pid5_10"],
    "Antagonism":      ["pid5_11","pid5_12","pid5_13","pid5_14","pid5_15"],
    "Disinhibition":   ["pid5_16","pid5_17","pid5_18","pid5_19","pid5_20"],
    "Psychoticism":    ["pid5_21","pid5_22","pid5_23","pid5_24","pid5_25"],
  };
  const scores: Record<string, number> = {};
  const questions = PID5.questions;
  Object.entries(domains).forEach(([domain, ids]) => {
    let sum = 0; let count = 0;
    ids.forEach(id => {
      const q   = questions.find(x => x.id === id);
      const res = responses[id];
      if (!q || res === undefined || res === "") return;
      const idx = q.options!.indexOf(res as string);
      if (idx !== -1) { sum += q.optionScores![idx]; count++; }
    });
    scores[domain] = count > 0 ? Math.round((sum / count) * 10) / 10 : 0;
  });
  return scores;
}
