/**
 * Longform narration schema — complete detailed forecast descriptions
 * spoken by Allan Jackson.
 *
 * The Wx_Phrases_Longform/ directory contains two types of clips:
 *
 * 1. **N-series** (558 clips): Complete standalone forecast descriptions.
 *    Each covers a full period's weather in natural language:
 *      "Partly cloudy early, then becoming mostly cloudy later tonight"
 *      "Scattered thunderstorms during the evening, then partly cloudy overnight"
 *    Transcriptions from assets/.../0Longform_Names.txt
 *
 * 2. **Numbered composites** (1,525 clips): Two-period condition pairs.
 *    Encoded as {CCSH_A}{CCSH_B}{timeVariant}{take}.mp3. Transcribed via
 *    Whisper and deduped to 549 unique phrases, merged into the same
 *    findLongformMatch pool below (AJ_COMPOSITE_CLIPS array).
 *
 * The N-series clips are the preferred narration for forecast periods when
 * a good match can be found against NWS detailedForecast text. They replace
 * the robotic "[period] [temp] [CCSH code]" pattern with natural sentences.
 *
 * Allan Jackson only. JC has a similar H-series set (559 clips) that could
 * be transcribed from Jim Cantore's Wx_Phrases_Longform/ in a future pass.
 */

import type { ClipResolution } from "./clipSchema";
import { AJ_VOCALLOCAL_BASE, JC_VOCALLOCAL_BASE } from "./narratorSchema";
import type { NarratorId } from "./narratorSchema";

const LF_DIR = `${AJ_VOCALLOCAL_BASE}/Wx_Phrases_Longform`;
const JC_LF_DIR = `${JC_VOCALLOCAL_BASE}/Wx_Phrases_Longform`;

// ────────────────────────────────────────────────────────────────────────────
//  N-series clip transcriptions (from 0Longform_Names.txt)
// ────────────────────────────────────────────────────────────────────────────

/** Compact entry: [filename_without_ext, transcription_text] */
type LfEntry = [string, string];

/**
 * All 566 longform clips (8 DUMMY + 558 N-series), transcribed.
 * Sorted by filename for binary search.
 */
const LONGFORM_CLIPS: LfEntry[] = [
  ["DUMMY1", "Scattered thunderstorms this evening, then partly cloudy"],
  ["DUMMY2", "Becoming clear"],
  ["DUMMY3", "Partly cloudy early, then mostly cloudy later tonight"],
  ["DUMMY4", "Partly cloudy early, then becoming mostly cloudy later in the day"],
  ["DUMMY5", "Partly cloudy early, the mostly cloudy later in the day"],
  ["DUMMY6", "Scattered thunderstorms during the evening"],
  ["DUMMY7", "Partly cloudy this evening, then becoming mostly cloudy after midnight"],
  ["DUMMY8", "Isolated thunderstorms during the evening"],
  ["N000039", "A chance of some strong thunderstorms"],
  ["N000055", "A few clouds early, but generally clear"],
  ["N000056", "A few clouds early, otherwise mostly sunny"],
  ["N000061", "A few clouds from time to time"],
  ["N000062", "A few clouds in the morning, but mainly sunny"],
  ["N000063", "A few clouds in the morning, otherwise sunny"],
  ["N000064", "A few clouds this evening, but mainly clear"],
  ["N000065", "A few clouds this morning, but generally sunny"],
  ["N000067", "A few clouds"],
  ["N000093", "A few isolated thunderstorms developing during the afternoon under partly cloudy skies"],
  ["N000094", "A few isolated thunderstorms developing during the afternoon"],
  ["N000102", "A few passing clouds, otherwise generally clear"],
  ["N000103", "A few passing clouds, otherwise generally sunny"],
  ["N000104", "A few passing clouds"],
  ["N000369", "A few showers early, with ample sunshine later in the day"],
  ["N000373", "A few showers early, with clearing later at night"],
  ["N000385", "A few showers early, with isolated thunderstorms developing later in the day"],
  ["N000389", "A few showers early, with mostly cloudy conditions late"],
  ["N000390", "A few showers early, with mostly cloudy conditions later in the day"],
  ["N000435", "A few showers early, followed by isolated thunderstorms later in the day"],
  ["N000617", "A few showers in the morning, with scattered thunderstorms arriving in the afternoon"],
  ["N000672", "A few showers this evening, with clearing overnight"],
  ["N000678", "A few showers this evening, with mostly clear conditions overnight"],
  ["N000679", "A few showers this evening, with mostly cloudy conditions overnight"],
  ["N000797", "A mainly sunny sky"],
  ["N000799", "A mix of clouds and sun during the morning will give way to cloudy skies during the afternoon"],
  ["N000801", "A mix of clouds and sun early, followed by cloudy skies this afternoon"],
  ["N000803", "A mix of clouds and sun early, then becoming cloudy later in the day"],
  ["N000810", "A mix of clouds and sun in the morning, giving way to a few showers during the afternoon"],
  ["N000811", "A mix of clouds and sun in the morning, giving way to a few snow showers during the afternoon"],
  ["N000890", "A mix of clouds and sun this morning, then strong thunderstorms this afternoon"],
  ["N000893", "A mix of clouds and sun this morning, with more sunshine this afternoon"],
  ["N000901", "A mix of clouds and sun with gusty winds"],
  ["N000902", "A mix of clouds and sun with a chance of an isolated thunderstorm in the afternoon"],
  ["N000908", "A mix of clouds and sun"],
  ["N002381", "A mix of light rain and snow after midnight"],
  ["N002384", "A mix of light rain and snow this afternoon"],
  ["N002620", "A mixture of rain and snow showers"],
  ["N002863", "A mostly clear sky"],
  ["N002997", "A steady light rain early, then remaining cloudy with a few showers"],
  ["N003041", "A steady rain in the evening, showers continuing late"],
  ["N003045", "A steady rain in the morning, showers continuing in the afternoon"],
  ["N003049", "A steady rain this evening, showers continuing overnight"],
  ["N003055", "A steady rain this morning, showers continuing this afternoon"],
  ["N003063", "A steady rain. The rain will be heavy at times"],
  ["N003472", "A wintry mix of snow, sleet, or freezing rain"],
  ["N003474", "Abundant sunshine"],
  ["N004420", "Becoming partly cloudy later, with any flurries or snow showers ending by midnight"],
  ["N004423", "Becoming partly cloudy later, with any flurries or snow showers ending by noontime"],
  ["N005526", "Clear and windy"],
  ["N005835", "Clear skies with a few passing clouds"],
  ["N005841", "Clear skies"],
  ["N005925", "Clear to partly cloudy in the evening, with more clouds for later at night"],
  ["N005927", "Clear to partly cloudy skies"],
  ["N005928", "Clear to partly cloudy"],
  ["N005930", "Clear with gusty winds"],
  ["N005935", "Clear"],
  ["N005976", "Clearing"],
  ["N005978", "Clouds and some sun this morning, with more clouds for this afternoon"],
  ["N005979", "Clouds and sun mixed in the morning, then generally sunny for the afternoon"],
  ["N006072", "Cloudy and blustery with snow showers"],
  ["N006354", "Cloudy and windy at times with periods of rain"],
  ["N006986", "Cloudy and windy with periods of light rain"],
  ["N007005", "Cloudy and windy with periods of rain"],
  ["N007386", "Cloudy and windy"],
  ["N007403", "Cloudy during the evening, a few showers developing late"],
  ["N007476", "Cloudy early with partial sunshine expected late"],
  ["N007477", "Cloudy early with peeks of sunshine expected late"],
  ["N007561", "Cloudy intervals"],
  ["N007653", "Cloudy skies early will become partly cloudy later in the day"],
  ["N007667", "Cloudy skies early, followed by partial clearing"],
  ["N007672", "Cloudy skies early, then partly cloudy after midnight"],
  ["N007673", "Cloudy skies early, then partly cloudy in the afternoon"],
  ["N007674", "Cloudy skies early, then partly cloudy this afternoon"],
  ["N007680", "Cloudy skies early, a few showers developing later in the day"],
  ["N007681", "Cloudy skies early, a few snow showers developing later in the day"],
  ["N007710", "Cloudy skies this evening, a few showers developing late"],
  ["N007711", "Cloudy skies this evening, a few snow showers developing late"],
  ["N007720", "Cloudy skies this morning, will become partly cloudy this afternoon"],
  ["N007727", "Cloudy skies with a few afternoon snow showers"],
  ["N007729", "Cloudy skies with a few late night snow showers"],
  ["N007730", "Cloudy skies with a few showers after midnight"],
  ["N007731", "Cloudy skies with a few showers later at night"],
  ["N007732", "Cloudy skies with a few showers later in the day"],
  ["N007735", "Cloudy skies with a few snow showers later at night"],
  ["N007736", "Cloudy skies with a few snow showers later in the day"],
  ["N007790", "Cloudy skies"],
  ["N007906", "Cloudy this morning, a few showers developing during the afternoon"],
  ["N007935", "Cloudy with a few showers"],
  ["N008020", "Cloudy with a mixture of light rain and snow developing late"],
  ["N008310", "Cloudy with gusty winds"],
  ["N009424", "Cloudy with occasional light rain"],
  ["N009430", "Cloudy with occasional rain throughout the day"],
  ["N009450", "Cloudy with occasional light rain"],
  ["N009456", "Cloudy with occasional rain showers"],
  ["N009492", "Cloudy with occasional showers arriving late"],
  ["N009493", "Cloudy with occasional showers"],
  ["N009495", "Cloudy with occasional showers, quite windy"],
  ["N009743", "Cloudy with periods of light rain"],
  ["N009855", "Cloudy with periods of rain"],
  ["N010299", "Cloudy with rain and snow showers early, changing to all rain and becoming intermittent late"],
  ["N010598", "Cloudy with rain and snow showers"],
  ["N010749", "Cloudy with rain and snow"],
  ["N010762", "Cloudy with rain developing after midnight"],
  ["N010936", "Cloudy with scattered snow showers, mainly during the evening"],
  ["N010937", "Cloudy with scattered snow showers, mainly during the morning"],
  ["N010942", "Cloudy with showers"],
  ["N011327", "Cloudy with snow flurries developing late"],
  ["N011332", "Cloudy with snow showers and flurries, becoming a steady light snow later"],
  ["N011337", "Cloudy with snow showers developing after midnight"],
  ["N011342", "Cloudy with snow showers early, and steady snow likely later in the day"],
  ["N011363", "Cloudy with snow showers, mainly during the evening"],
  ["N011364", "Cloudy with snow showers, mainly during the morning"],
  ["N011371", "Cloudy with snow showers, brisk winds will reduce visibilities in some of the snow showers"],
  ["N011676", "Cloudy with snow, sleet, or freezing rain"],
  ["N011677", "Cloudy with snow"],
  ["N011682", "Cloudy with some light snow"],
  ["N011834", "Cloudy, snow likely this afternoon"],
  ["N011840", "Cloudy, snow showers possible in the afternoon"],
  ["N011847", "Cloudy, some light rain is likely"],
  ["N011848", "Cloudy, some light rain will fall throughout the day"],
  ["N011901", "Cloudy"],
  ["N011915", "Considerable cloudiness with occasional rain showers"],
  ["N011916", "Considerable cloudiness, occasional rain showers developing after midnight"],
  ["N011920", "Considerable cloudiness"],
  ["N011921", "Considerable clouds early, some decreasing clouds late"],
  ["N011922", "Considerable clouds early, some decreasing clouds later in the day"],
  ["N011923", "Considerable clouds this evening, some decrease in clouds late"],
  ["N011924", "Considerable clouds this morning, some decrease in clouds later in the day"],
  ["N011939", "Decreasing cloudiness"],
  ["N013132", "Evening showers, becoming partly cloudy late"],
  ["N013133", "Evening showers, becoming partly cloudy overnight"],
  ["N013179", "Except for a few afternoon clouds, mainly sunny"],
  ["N013191", "Fair skies"],
  ["N013192", "Fair to partly cloudy"],
  ["N013193", "Flurries and a few snow showers throughout the day"],
  ["N013194", "Flurries and a few snow showers throughout the night"],
  ["N013206", "Flurries and snow showers early, becoming more scattered later"],
  ["N013215", "Flurries and snow showers this evening, becoming more scattered later"],
  ["N013228", "Flurries and some snow showers in the evening, becoming less likely during the morning"],
  ["N013230", "Flurries and some snow showers in the morning, becoming less likely toward evening"],
  ["N013232", "Flurries and some snow showers this evening, becoming less likely by morning"],
  ["N014805", "Foggy"],
  ["N018443", "Frequent snow showers will become more widely scattered by late at night"],
  ["N018445", "Frequent snow showers will become more widely scattered by late in the day"],
  ["N018446", "Frequent snow showers will become more widely scattered by late night"],
  ["N018451", "Generally clear skies with a few passing clouds"],
  ["N018453", "Generally clear skies"],
  ["N018454", "Generally clear"],
  ["N018455", "Generally cloudy"],
  ["N018456", "Generally fair skies"],
  ["N018457", "Generally fair"],
  ["N018458", "Generally sunny despite a few afternoon clouds"],
  ["N018459", "Generally sunny"],
  ["N021978", "Heavy snow"],
  ["N022258", "Increasing clouds with showers arriving overnight"],
  ["N022340", "Intervals of clouds and sunshine, with more clouds for later in the day"],
  ["N022341", "Intervals of clouds and sunshine"],
  ["N022381", "Isolated thunderstorms during the evening, followed by a chance of showers overnight"],
  ["N022396", "Isolated thunderstorms during the evening hours, skies will become partly cloudy overnight"],
  ["N022417", "Isolated thunderstorms during the evening, then mainly cloudy overnight"],
  ["N022425", "Isolated thunderstorms during the evening, then partly cloudy overnight"],
  ["N022429", "Isolated thunderstorms during the evening, then skies turning partly cloudy overnight"],
  ["N022469", "Isolated thunderstorms during the evening, mainly clear skies after midnight"],
  ["N022604", "Isolated thunderstorms, then partly cloudy after midnight"],
  ["N022651", "Isolated thunderstorms ending during the evening, becoming clear overnight"],
  ["N022657", "Isolated thunderstorms ending early, becoming clear after midnight"],
  ["N022829", "Isolated thunderstorms in the evening, clear skies overnight"],
  ["N022836", "Isolated thunderstorms in the evening, mostly cloudy skies overnight"],
  ["N022942", "Isolated thunderstorms in the morning, then partly cloudy late"],
  ["N022948", "Isolated thunderstorms in the morning, then skies turning partly cloudy late"],
  ["N023104", "Isolated thunderstorms in the evening, then skies turning partly cloudy after midnight"],
  ["N023143", "Isolated thunderstorms this evening, skies will become partly cloudy after midnight"],
  ["N028165", "Light rain early, then remaining cloudy with showers in the afternoon"],
  ["N028166", "Light rain early, then remaining cloudy with showers late"],
  ["N028167", "Light rain early, then remaining cloudy with showers overnight"],
  ["N030112", "Light snow during the morning will give way to a few snow showers during the afternoon"],
  ["N030142", "Light snow during the morning will give way to showers of rain and wet snow during the afternoon"],
  ["N030145", "Light snow during the morning will give way to snow showers during the afternoon"],
  ["N030323", "Light snow in the evening will give way to a few snow showers overnight"],
  ["N030356", "Light snow in the evening will give way to snow showers overnight"],
  ["N030503", "Light snow this evening will give way to a few snow showers late"],
  ["N030536", "Light snow this evening will give way to snow showers late"],
  ["N031871", "Locally strong thunderstorms possible"],
  ["N031872", "Lots of sunshine"],
  ["N031941", "Mainly clear skies"],
  ["N031942", "Mainly clear"],
  ["N032018", "Mainly cloudy, a few peeks of sunshine possible"],
  ["N032027", "Mainly cloudy"],
  ["N032032", "Mainly sunny to start, then a few afternoon clouds"],
  ["N032033", "Mainly sunny"],
  ["N032035", "Mixed clouds and sun with scattered thunderstorms"],
  ["N032073", "More clouds than sun"],
  ["N032394", "Morning showers, becoming more partly cloudy in the afternoon"],
  ["N032459", "Morning sunshine will give way to isolated thunderstorms during the afternoon"],
  ["N032956", "Mostly clear skies"],
  ["N033043", "Mostly clear"],
  ["N033584", "Mostly cloudy and windy"],
  ["N033608", "Mostly cloudy during the evening, a few snow showers developing late"],
  ["N033847", "Mostly cloudy skies early will become partly cloudy late"],
  ["N033848", "Mostly cloudy skies early will become partly cloudy later in the day"],
  ["N033866", "Mostly cloudy skies early, then partly cloudy after midnight"],
  ["N033867", "Mostly cloudy skies early, then partly cloudy in the afternoon"],
  ["N033868", "Mostly cloudy skies early, then partly cloudy this afternoon"],
  ["N033874", "Mostly cloudy skies early, a few showers developing later in the day"],
  ["N033875", "Mostly cloudy skies early, a few snow showers developing later in the day"],
  ["N033899", "Mostly cloudy skies this evening will become partly cloudy after midnight"],
  ["N033915", "Mostly cloudy skies this morning will become partly cloudy this afternoon"],
  ["N033925", "Mostly cloudy skies with a few showers after midnight"],
  ["N033926", "Mostly cloudy skies with a few showers late"],
  ["N033927", "Mostly cloudy skies with a few showers later in the day"],
  ["N033930", "Mostly cloudy skies with a few snow showers late"],
  ["N033931", "Mostly cloudy skies with a few snow showers later in the day"],
  ["N033998", "Mostly cloudy skies"],
  ["N034113", "Mostly cloudy this morning, a few showers developing during the afternoon"],
  ["N034436", "Mostly cloudy with scattered snow flurries and snow showers"],
  ["N034450", "Mostly cloudy with scattered snow showers mainly during the evening"],
  ["N034451", "Mostly cloudy with scattered snow showers mainly during the morning"],
  ["N034461", "Mostly cloudy with showers and a few thunderstorms"],
  ["N034475", "Mostly cloudy with snow flurries and snow showers becoming more widespread in the afternoon"],
  ["N034482", "Mostly cloudy with snow flurries and snow showers possible"],
  ["N034496", "Mostly cloudy with snow showers mainly during the evening"],
  ["N034497", "Mostly cloudy with snow showers mainly during the morning"],
  ["N034533", "Mostly cloudy, intermittent snow showers ending by midnight"],
  ["N034534", "Mostly cloudy, intermittent snow showers ending in the morning"],
  ["N034552", "Mostly cloudy, rain and snow showers this morning, a few rain showers in the afternoon"],
  ["N034570", "Mostly cloudy, some flurries or snow showers are possible"],
  ["N034583", "Mostly cloudy"],
  ["N034833", "Mostly sunny in the morning, with isolated thunderstorms developing later in the day"],
  ["N034953", "Mostly sunny skies with gusty winds developing later in the day"],
  ["N034954", "Mostly sunny skies with gusty winds"],
  ["N034956", "Mostly sunny skies, becoming windy late"],
  ["N034959", "Mostly sunny skies"],
  ["N034982", "Mostly sunny with gusty winds developing this afternoon"],
  ["N034983", "Mostly sunny, becoming windy during the afternoon"],
  ["N034985", "Mostly sunny"],
  ["N035195", "Occasional light rain"],
  ["N035545", "Occasional rain"],
  ["N035580", "Occasional snow showers"],
  ["N035591", "Off and on snow flurries are possible, along with variably cloudy skies"],
  ["N035601", "On and off snow showers ending, breaks in the overcast later"],
  ["N035608", "On and off snow showers ending, peeks of sunshine later"],
  ["N035630", "Overcast skies and windy"],
  ["N035640", "Overcast with rain showers at times"],
  ["N035641", "Overcast with showers at times"],
  ["N035645", "Overcast"],
  ["N035647", "Partial cloudiness early, with scattered showers and thunderstorms in the afternoon"],
  ["N035911", "Partly cloudy and windy with a slight chance of thunderstorms"],
  ["N035916", "Partly cloudy and windy with isolated thunderstorms possible"],
  ["N035920", "Partly cloudy and windy"],
  ["N035921", "Partly cloudy during the evening, followed by cloudy skies overnight"],
  ["N035937", "Partly cloudy during the evening, a few showers developing later during the night"],
  ["N035938", "Partly cloudy during the evening, a few snow showers developing later during the night"],
  ["N035947", "Partly cloudy early, followed by cloudy skies overnight"],
  ["N035949", "Partly cloudy early, followed by increasing clouds with showers developing later in the day"],
  ["N035950", "Partly cloudy early, followed by mostly cloudy skies and a few showers later in the day"],
  ["N035959", "Partly cloudy early, followed by strong thunderstorms this afternoon"],
  ["N036034", "Partly cloudy early, with strong thunderstorms likely later in the day"],
  ["N036039", "Partly cloudy early with increasing clouds overnight"],
  ["N036054", "Partly cloudy early, scattered strong thunderstorms developing this afternoon"],
  ["N036055", "Partly cloudy early, scattered thunderstorms developing later in the day"],
  ["N036094", "Partly cloudy in the evening, increasing clouds with periods of showers after midnight"],
  ["N036098", "Partly cloudy in the morning, followed by scattered thunderstorms later in the day"],
  ["N036099", "Partly cloudy in the morning, followed by strong thunderstorms later in the day"],
  ["N036133", "Partly cloudy in the morning, increasing clouds with periods of showers later in the day"],
  ["N036134", "Partly cloudy in the morning, scattered strong thunderstorms developing later in the day"],
  ["N036138", "Partly cloudy skies during the evening, giving way to a few showers after midnight"],
  ["N036139", "Partly cloudy skies during the evening, giving way to a few snow showers after midnight"],
  ["N036151", "Partly cloudy skies during the evening will give way to cloudy skies overnight"],
  ["N036187", "Partly cloudy skies during the morning hours will give way to occasional showers in the afternoon"],
  ["N036196", "Partly cloudy skies during the morning hours, strong thunderstorms will develop in the afternoon"],
  ["N036221", "Partly cloudy skies early, followed by increasing clouds with showers developing later at night"],
  ["N036222", "Partly cloudy skies early, followed by mostly cloudy skies and a few showers later at night"],
  ["N036235", "Partly cloudy skies early, followed by mostly cloudy skies and a few snow showers later at night"],
  ["N036236", "Partly cloudy skies early giving way to a few showers after midnight"],
  ["N036237", "Partly cloudy skies early giving way to a few snow showers after midnight"],
  ["N036310", "Partly cloudy skies early will become overcast later during the night"],
  ["N036327", "Partly cloudy skies early will give way to cloudy skies late"],
  ["N036343", "Partly cloudy skies early will give way to occasional showers later during the night"],
  ["N036365", "Partly cloudy skies early, a few showers developing later in the day"],
  ["N036366", "Partly cloudy skies early, a few snow showers developing later in the day"],
  ["N036384", "Partly cloudy skies in the evening, then becoming cloudy overnight"],
  ["N036386", "Partly cloudy skies in the morning will give way to cloudy skies during the afternoon"],
  ["N036391", "Partly cloudy skies this evening will become overcast overnight"],
  ["N036411", "Partly cloudy skies this evening will give way to occasional showers overnight"],
  ["N036423", "Partly cloudy skies this evening, increasing clouds with periods of showers late"],
  ["N036428", "Partly cloudy skies this morning will become overcast during the afternoon"],
  ["N036457", "Partly cloudy skies this morning, strong thunderstorms will develop during the afternoon"],
  ["N036463", "Partly cloudy skies with gusty winds"],
  ["N036470", "Partly cloudy skies, gusty winds during the evening"],
  ["N036473", "Partly cloudy skies"],
  ["N036477", "Partly cloudy this evening, followed by increasing clouds with showers developing after midnight"],
  ["N036478", "Partly cloudy this evening, followed by mostly cloudy skies and a few showers after midnight"],
  ["N036485", "Partly cloudy this evening, followed by mostly cloudy skies and a few snow showers after midnight"],
  ["N036539", "Partly cloudy this evening with more clouds for overnight"],
  ["N036541", "Partly cloudy this evening, then becoming cloudy after midnight"],
  ["N036582", "Partly cloudy with a slight chance of thunderstorms"],
  ["N036583", "Partly cloudy with afternoon thunderstorms"],
  ["N036585", "Partly cloudy with isolated thunderstorms developing during the afternoon"],
  ["N036589", "Partly cloudy with isolated thunderstorms possible"],
  ["N036591", "Partly cloudy with scattered strong thunderstorms developing during the afternoon"],
  ["N036592", "Partly cloudy with scattered strong storms developing in the afternoon"],
  ["N036609", "Partly cloudy, windy"],
  ["N036610", "Partly cloudy"],
  ["N036611", "Partly to mostly cloudy and windy"],
  ["N036612", "Partly to mostly cloudy skies with a few showers possible"],
  ["N036613", "Partly to mostly cloudy skies with scattered thunderstorms before midnight"],
  ["N036614", "Partly to mostly cloudy skies with scattered thunderstorms during the evening"],
  ["N036618", "Partly to mostly cloudy skies with scattered thunderstorms mainly during the evening"],
  ["N036620", "Partly to mostly cloudy skies with scattered thunderstorms mainly in the morning"],
  ["N036623", "Partly to mostly cloudy with a chance of thunderstorms"],
  ["N036636", "Partly to mostly cloudy with scattered showers"],
  ["N036641", "Partly to mostly cloudy"],
  ["N039448", "Periods of light snow"],
  ["N039948", "Periods of rain and snow"],
  ["N040047", "Periods of rain, the rain will be heavy at times"],
  ["N040053", "Periods of rain"],
  ["N040319", "Periods of snow and gusty winds"],
  ["N040425", "Periods of snow and windy"],
  ["N040559", "Periods of snow, sleet, or freezing rain"],
  ["N040572", "Periods of snow, snow will be heavy at times especially during the morning"],
  ["N040573", "Periods of snow, snow will be heavy at times especially in the evening"],
  ["N040575", "Periods of snow, snow will be heavy at times especially this morning"],
  ["N040596", "Periods of snow"],
  ["N040597", "Plentiful sunshine"],
  ["N040599", "Plenty of sunshine"],
  ["N043676", "Rain and snow showers in the evening, tapering to snow showers late"],
  ["N043966", "Rain and snow showers in the morning, the rain and snow will change to rain showers in the afternoon"],
  ["N044060", "Rain and snow showers this evening, tapering to snow showers overnight"],
  ["N044304", "Rain and snow showers this morning, a shower or two in the afternoon, otherwise mostly cloudy"],
  ["N044970", "Rain and wind"],
  ["N045135", "Rain early, then remaining cloudy with showers in the afternoon"],
  ["N045136", "Rain early, then remaining cloudy with showers late"],
  ["N045137", "Rain early, then remaining cloudy with showers overnight"],
  ["N045274", "Rain likely with a few thunderstorms"],
  ["N045311", "Rain likely"],
  ["N045438", "Rain showers early, becoming a steady light rain overnight"],
  ["N045443", "Rain showers early, becoming more intermittent by afternoon"],
  ["N045444", "Rain showers early, becoming more intermittent overnight"],
  ["N045457", "Rain showers early, becoming steady by the afternoon"],
  ["N045458", "Rain showers early, becoming steady overnight"],
  ["N045541", "Rain showers early, mixing with snow showers late"],
  ["N045657", "Rain showers early with scattered thunderstorms arriving by the afternoon"],
  ["N045702", "Rain showers ending early with ample sunshine later in the day"],
  ["N045707", "Rain showers ending early with clearing later at night"],
  ["N045715", "Rain showers ending early with mostly cloudy conditions late"],
  ["N045716", "Rain showers ending early with mostly cloudy conditions later in the day"],
  ["N045761", "Rain showers ending this evening with clearing overnight"],
  ["N045764", "Rain showers ending this evening with mostly clear conditions overnight"],
  ["N045765", "Rain showers ending this evening with mostly cloudy conditions overnight"],
  ["N045779", "Rain showers in the evening becoming a steady light rain overnight"],
  ["N045781", "Rain showers in the evening becoming more intermittent overnight"],
  ["N045786", "Rain showers in the evening becoming steady overnight"],
  ["N045868", "Rain showers in the morning, becoming a steady light rain in the afternoon"],
  ["N045870", "Rain showers in the morning becoming more intermittent in the afternoon"],
  ["N045875", "Rain showers in the morning becoming steady in the afternoon"],
  ["N045934", "Rain showers in the morning with numerous thunderstorms developing in the afternoon"],
  ["N045938", "Rain showers in the morning with scattered thunderstorms arriving in the afternoon"],
  ["N045942", "Rain showers in the morning with thunderstorms developing in the afternoon"],
  ["N045979", "Rain showers this evening mixing with snow showers overnight"],
  ["N047772", "Rain"],
  ["N047806", "Scattered clouds with a possibility of an isolated thunderstorm developing during the afternoon"],
  ["N047817", "Scattered flurries and snow showers"],
  ["N047870", "Scattered showers and thunderstorms"],
  ["N048397", "Scattered showers in the morning, then a slight chance of thunderstorms in the afternoon"],
  ["N048461", "Scattered showers in the morning, then variable clouds during the afternoon with isolated thunderstorms"],
  ["N048770", "Scattered snow flurries and snow showers before noon, becoming partly cloudy later"],
  ["N048888", "Scattered strong thunderstorms developing during the afternoon"],
  ["N048890", "Scattered strong thunderstorms developing this afternoon"],
  ["N048899", "Scattered strong thunderstorms"],
  ["N048949", "Scattered thunderstorms during the evening followed by occasional showers overnight"],
  ["N048991", "Scattered thunderstorms during the evening, then partly cloudy overnight"],
  ["N049032", "Scattered thunderstorms during the evening, partly cloudy skies after midnight"],
  ["N049172", "Scattered thunderstorms early, then partly cloudy after midnight"],
  ["N049176", "Scattered thunderstorms early, then variable clouds overnight with more showers at times"],
  ["N049360", "Scattered thunderstorms in the evening, then variable clouds overnight with more showers at times"],
  ["N049406", "Scattered thunderstorms in the evening, partly cloudy skies overnight"],
  ["N049419", "Scattered thunderstorms in the morning, becoming more widespread in the afternoon"],
  ["N049501", "Scattered thunderstorms in the morning, then mainly cloudy during the afternoon with thunderstorms likely"],
  ["N049521", "Scattered thunderstorms in the morning, then partly cloudy late"],
  ["N049605", "Scattered thunderstorms in the morning, partly cloudy skies late"],
  ["N049622", "Scattered thunderstorms this evening followed by occasional showers overnight"],
  ["N049830", "Scattered thunderstorms, especially during the evening"],
  ["N049832", "Scattered thunderstorms, especially in the afternoon"],
  ["N049833", "Scattered thunderstorms, especially in the evening"],
  ["N049834", "Scattered thunderstorms, especially in the morning"],
  ["N049895", "Scattered thunderstorms, some strong during the evening, then partly cloudy overnight"],
  ["N049897", "Scattered thunderstorms, some strong during the evening, then skies turning partly cloudy overnight"],
  ["N049919", "Scattered thunderstorms, some strong during the evening, will give way to partly cloudy skies after midnight"],
  ["N050050", "Scattered thunderstorms, some strong early, then partly cloudy after midnight"],
  ["N050173", "Scattered thunderstorms, some strong in the evening, will give way to partly cloudy skies overnight"],
  ["N050446", "Scattered thunderstorms, some strong this evening, then skies turning partly cloudy after midnight"],
  ["N050664", "Scattered thunderstorms"],
  ["N050677", "Showers and scattered thunderstorms"],
  ["N051240", "Showers and thundershowers likely"],
  ["N051493", "Showers during the evening, followed by partly cloudy skies late"],
  ["N051494", "Showers during the evening, followed by partly cloudy skies overnight"],
  ["N051503", "Showers during the morning, followed by partly cloudy skies in the afternoon"],
  ["N051510", "Showers early, becoming a steady light rain late"],
  ["N051511", "Showers early, becoming a steady light rain later in the day"],
  ["N051519", "Showers early, becoming less numerous late"],
  ["N051520", "Showers early, becoming less numerous later in the day"],
  ["N051609", "Showers early, with scattered thunderstorms developing later in the day"],
  ["N051651", "Showers early, becoming a steady rain late"],
  ["N051652", "Showers early, becoming a steady rain later in the day"],
  ["N051674", "Showers early, then clearing overnight"],
  ["N051677", "Showers early, then cloudy overnight"],
  ["N051700", "Showers ending early, with partial clearing overnight"],
  ["N051702", "Showers ending early with some clearing overnight"],
  ["N051705", "Showers ending early, then partly cloudy overnight"],
  ["N051709", "Showers ending in the evening, with partial clearing overnight"],
  ["N051710", "Showers ending in the evening with some clearing overnight"],
  ["N051711", "Showers ending in the evening, then partly cloudy overnight"],
  ["N051715", "Showers ending in the morning with partial clearing in the afternoon"],
  ["N051716", "Showers ending in the morning with some clearing in the afternoon"],
  ["N051717", "Showers ending in the morning, then partly cloudy in the afternoon"],
  ["N051776", "Showers in the evening, then clearing overnight"],
  ["N051777", "Showers in the evening, then cloudy overnight"],
  ["N051812", "Showers in the morning, with isolated thunderstorms arriving in the afternoon"],
  ["N051813", "Showers in the morning, with isolated thunderstorms in the afternoon"],
  ["N051835", "Showers in the morning, then cloudy in the afternoon"],
  ["N051858", "Showers this evening, becoming a steady light rain overnight"],
  ["N051860", "Showers this evening, becoming less numerous overnight"],
  ["N051894", "Showers this evening, becoming a steady rain overnight"],
  ["N051900", "Showers this morning, becoming less numerous during the afternoon hours"],
  ["N051925", "Showers this morning, then scattered thunderstorms developing during the afternoon hours"],
  ["N051934", "Showers this morning, becoming a steady rain during the afternoon hours"],
  ["N052953", "Snow along with gusty winds at times"],
  ["N053312", "Snow and gusty winds. Snow will become heavy during the afternoon"],
  ["N053313", "Snow and gusty winds. Snow will become heavy late"],
  ["N053314", "Snow and gusty winds. Snow will become heavy overnight"],
  ["N053315", "Snow and gusty winds. Snow will become heavy this afternoon"],
  ["N053935", "Snow during the morning will become heavy at times during the afternoon"],
  ["N054051", "Snow during the morning will taper off to light snow during the afternoon"],
  ["N054164", "Snow flurries and snow showers early with a chance of lingering snow showers later"],
  ["N054178", "Snow flurries and snow showers tapering off later"],
  ["N054190", "Snow flurries and snow showers"],
  ["N054303", "Snow flurries or snow showers"],
  ["N054399", "Snow in the evening will become heavy at times overnight"],
  ["N054540", "Snow likely"],
  ["N054596", "Snow showers and steadier snow developing later in the day"],
  ["N054597", "Snow showers and a steadier snow developing late"],
  ["N054653", "Snow showers ending, bright sunshine later"],
  ["N054725", "Snow this evening will become heavy at times late"],
  ["N054726", "Snow this evening will become lighter late"],
  ["N054841", "Snow this evening will taper off to light snow late"],
  ["N054875", "Snow this morning will become heavy at times this afternoon"],
  ["N055020", "Snow will be heavy at times along with gusty winds"],
  ["N055030", "Snow will become heavy at times during the afternoon"],
  ["N055031", "Snow will become heavy at times late"],
  ["N055032", "Snow will become heavy at times overnight"],
  ["N055033", "Snow will become heavy at times this afternoon"],
  ["N057091", "Snow. Snow will be heavy at times during the morning"],
  ["N057092", "Snow. Snow will be heavy at times in the evening"],
  ["N057093", "Snow. Snow will be heavy at times this evening"],
  ["N057094", "Snow. Snow will be heavy at times this morning"],
  ["N057145", "Snow, heavy at times"],
  ["N057167", "Snowy and windy. Snow will become heavy at times during the afternoon"],
  ["N057168", "Snowy and windy. Snow will become heavy at times late"],
  ["N057169", "Snowy and windy. Snow will become heavy at times overnight"],
  ["N057170", "Snowy and windy. Snow will become heavy at times this afternoon"],
  ["N057185", "Some clouds and possibly an isolated thunderstorm in the afternoon"],
  ["N057194", "Some clouds"],
  ["N057195", "Some early morning breaks in the overcast, otherwise cloudy"],
  ["N057248", "Some passing clouds"],
  ["N057298", "Some sun in the morning, with increasing clouds during the afternoon"],
  ["N057299", "Some sun this morning with increasing clouds this afternoon"],
  ["N058093", "Steady light rain in the evening, showers continuing late"],
  ["N058095", "Steady light rain in the morning, showers continuing in the afternoon"],
  ["N058097", "Steady light rain this evening, showers continuing overnight"],
  ["N058099", "Steady light rain this morning, showers continuing this afternoon"],
  ["N058126", "Strong thunderstorms likely"],
  ["N058132", "Sun along with patchy clouds"],
  ["N058133", "Sun and a few passing clouds"],
  ["N058134", "Sun and clouds mixed with a slight chance of thunderstorms during the afternoon"],
  ["N058135", "Sunny along with a few clouds"],
  ["N058247", "Sunny and windy"],
  ["N058518", "Sunny skies with gusty winds developing later in the day"],
  ["N058520", "Sunny skies, becoming windy late"],
  ["N058521", "Sunny skies, gusty winds during the morning"],
  ["N058522", "Sunny skies, gusty winds in the morning"],
  ["N058523", "Sunny skies"],
  ["N058547", "Sunny to partly cloudy"],
  ["N058548", "Sunny with gusty winds developing this afternoon"],
  ["N058549", "Sunny with gusty winds"],
  ["N058550", "Sunny along with a few afternoon clouds"],
  ["N058551", "Sunny, becoming windy late"],
  ["N058552", "Sunny, gusty winds diminishing during the afternoon"],
  ["N058553", "Sunny, gusty winds diminishing in the afternoon"],
  ["N058554", "Sunny, windy during the morning"],
  ["N058555", "Sunny"],
  ["N058556", "Sunshine along with a few clouds"],
  ["N058557", "Sunshine along with some cloudy intervals"],
  ["N058558", "Sunshine along with some passing clouds"],
  ["N058559", "Sunshine and a few afternoon clouds"],
  ["N058560", "Sunshine and a few clouds"],
  ["N058666", "Sunshine to start, then a few afternoon clouds"],
  ["N058667", "Sunshine"],
  ["N059716", "Thunderstorms likely"],
  ["N059972", "Thunderstorms, especially during the evening"],
  ["N059974", "Thunderstorms, especially early in the day"],
  ["N060260", "Thunderstorms, some strong during the evening, will give way to partly cloudy skies after midnight"],
  ["N060297", "Thunderstorms, some strong during the evening, then partly cloudy overnight"],
  ["N060299", "Thunderstorms, some strong during the evening, then skies turning partly cloudy overnight"],
  ["N060451", "Thunderstorms, some strong early, then partly cloudy after midnight"],
  ["N060506", "Thunderstorms, some strong in the evening, will give way to partly cloudy skies overnight"],
  ["N060842", "Thunderstorms, some strong this evening, then skies turning partly cloudy after midnight"],
  ["N061132", "Thunderstorms"],
  ["N061133", "Variable cloudiness and windy"],
  ["N061233", "Variable clouds with showers"],
  ["N061238", "Variable clouds with a few snow showers or flurries expected"],
  ["N061243", "Variable clouds with numerous snow showers or flurries expected"],
  ["N061256", "Variable clouds with scattered showers and thunderstorms, mainly in the afternoon"],
  ["N061280", "Variable clouds with scattered showers"],
  ["N061281", "Variable clouds with scattered strong thunderstorms"],
  ["N061282", "Variable clouds with thunderstorms"],
  ["N061283", "Variable clouds with showers and scattered thunderstorms, storms more numerous during the evening"],
  ["N061286", "Variable clouds with showers and scattered thunderstorms, storms more numerous this evening"],
  ["N061287", "Variable clouds with showers and scattered thunderstorms"],
  ["N061317", "Variable clouds with strong thunderstorms"],
  ["N061330", "Variable clouds with thunderstorms, especially early"],
  ["N061331", "Variable clouds with thunderstorms, especially in the afternoon"],
  ["N061332", "Variable clouds with thunderstorms, especially in the morning"],
  ["N061339", "Variable clouds with thunderstorms, a few may be severe, especially this morning"],
  ["N061438", "Variably cloudy with light snow flurries possible"],
  ["N061442", "Variably cloudy with scattered thunderstorms"],
  ["N061579", "Widely scattered showers and thunderstorms should diminish as the evening progresses"],
  ["N061927", "Winds increasing, a few clouds from time to time"],
  ["N062416", "Windy and overcast with showers"],
  ["N062689", "Windy at times with periods of rain"],
  ["N063142", "Windy early, with rain showers mixing with snow showers late"],
  ["N063676", "Windy with a few clouds from time to time"],
  ["N063984", "Windy with a few showers possible"],
  ["N064139", "Windy with a mix of clouds and sun"],
  ["N064463", "Windy with clear skies"],
  ["N066282", "Windy with light rain likely"],
  ["N067139", "Windy with lots of sunshine"],
  ["N067164", "Windy with mostly cloudy skies"],
  ["N067215", "Windy with occasional light rain"],
  ["N067403", "Windy with occasional snow showers"],
  ["N067407", "Windy with partly cloudy skies"],
  ["N067620", "Windy with period of light rain"],
  ["N068160", "Windy with periods of rain"],
  ["N070126", "Windy with rain likely"],
  ["N070390", "Windy with rain showers likely"],
  ["N070677", "Windy with rain, heavy at times"],
  ["N072155", "Windy with scattered thunderstorms"],
  ["N072583", "Windy with showers and thunderstorms likely"],
  ["N074031", "Windy with sunshine"],
  ["N076632", "Windy, periods of light rain this afternoon"],
];

// ────────────────────────────────────────────────────────────────────────────
//  JC-exclusive H08xxxx longform clips (transcribed via Whisper 2026-04-13)
// ────────────────────────────────────────────────────────────────────────────

/**
 * JC-exclusive H08xxxx longform clips (364 clips).
 * These have no AJ N-series equivalent — they're unique to Jim Cantore.
 * Transcribed via faster-whisper 'small' model; confidence values retained.
 */
const JC_EXCLUSIVE_CLIPS: LfEntry[] = [
  ["H080001", "A few flurries or snow showers"],  // conf: -0.271
  ["H080002", "A few isolated thunderstorms developing this afternoon"],  // conf: -0.324
  ["H080003", "A few rain showers this evening, mixing with snow showers overnight"],  // conf: -0.296
  ["H080004", "A few showers and perhaps a thunderstorm possible"],  // conf: -0.35
  ["H080005", "A few showers early will become a steady light rain in the afternoon"],  // conf: -0.212
  ["H080006", "A few showers early, then clouds lingering in the afternoon"],  // conf: -0.278
  ["H080007", "A few showers early, then clouds lingering later at night"],  // conf: -0.308
  ["H080008", "A few showers in the morning will transition to a steady light rain in the afternoon"],  // conf: -0.166
  ["H080009", "A few showers possible in the evening with a light-wintery mix developing overnight"],  // conf: -0.27
  ["H080010", "A few showers possible this morning, then scattered thunderstorms developing during the afternoon hours. Some storms could be strong to severe"],  // conf: -0.256
  ["H080011", "A few showers this evening, then clouds lingering overnight"],  // conf: -0.271
  ["H080012", "A few snow showers possible this morning, otherwise windy"],  // conf: -0.36
  ["H080013", "A few snow showers scattered about the area in the morning, otherwise a good deal of clouds"],  // conf: -0.202
  ["H080014", "A light wintery mix early, precipitation will change to mostly freezing rain for the afternoon"],  // conf: -0.246
  ["H080015", "A light-wintery mix in the morning will transition to mainly rain showers in the afternoon"],  // conf: -0.237
  ["H080016", "A light went remix"],  // conf: -0.416
  ["H080017", "A mix of clouds and sun in the morning, followed by cloudy skies during the afternoon"],  // conf: -0.206
  ["H080018", "A mix of clouds and sun this morning. A few showers are possible this afternoon"],  // conf: -0.267
  ["H080019", "A mix of clouds and sun with a slight chance of thunderstorms this afternoon"],  // conf: -0.167
  ["H080020", "A mix of light rain and snow overnight"],  // conf: -0.306
  ["H080021", "A mixture of light went her precipitation"],  // conf: -0.323
  ["H080022", "A shower or thunderstorm possible in the morning, then frequent rain showers along with heavy downpours and strong wind gusts during the afternoon"],  // conf: -0.149
  ["H080023", "A shower or thunderstorm possible this evening, clouds lingering overnight"],  // conf: -0.265
  ["H080024", "A shower or two around the area early, then partly cloudy during the afternoon"],  // conf: -0.256
  ["H080025", "A shower or two possible in the morning, then clearing with sunshine in the afternoon"],  // conf: -0.26
  ["H080026", "A shower or two possible this morning with partly cloudy skies this afternoon"],  // conf: -0.249
  ["H080027", "A snow shower or two is possible, otherwise windy"],  // conf: -0.326
  ["H080028", "A steady rain early, then remaining cloudy with a few showers"],  // conf: -0.251
  ["H080029", "A stray shower or thunderstorm possible in the morning, then widespread rain showers accompanied by heavy downpours and strong wind gusts in the afternoon"],  // conf: -0.184
  ["H080030", "A thunderstorm possible in a few areas this evening, then mostly cloudy overnight"],  // conf: -0.287
  ["H080031", "An isolated thunderstorm possible this evening, then showers likely overnight, along with a thunderstorm or two"],  // conf: -0.285
  ["H080032", "Areas of fog early, then partly cloudy in the afternoon"],  // conf: -0.278
  ["H080033", "Areas of fog"],  // conf: -0.417
  ["H080034", "Bands of heavy rain containing strong gusty winds at times"],  // conf: -0.258
  ["H080035", "Blizzard conditions with heavy snow and gusty winds this evening will give way to snow showers overnight"],  // conf: -0.255
  ["H080036", "Chance of a few showers early, scattered showers or thunderstorms around for the afternoon"],  // conf: -0.302
  ["H080037", "Chats of a shower or two during the morning followed by partly cloudy skies this afternoon"],  // conf: -0.222
  ["H080038", "Chance of a shower or two early, then scattered thunderstorms this afternoon. Storms could be strong and perhaps severe"],  // conf: -0.304
  ["H080039", "Chance of isolated thunderstorms this morning then showers and thunderstorms likely during the afternoon hours. Some storms will be strong and locally severe"],  // conf: -0.271
  ["H080040", "Cloudy during the evening, a few snow showers developing late"],  // conf: -0.273
  ["H080041", "Cloudy early scattered thunderstorms this afternoon. Some storms will be strong to perhaps severe"],  // conf: -0.3
  ["H080042", "Cloudy in the morning, then off and on rain showers during the afternoon hours"],  // conf: -0.204
  ["H080043", "Cloudy skies early will become partly cloudy later at night"],  // conf: -0.24
  ["H080044", "Cloudy skies early, then off and on rain showers overnight"],  // conf: -0.267
  ["H080045", "Cloudy skies with a few showers this afternoon"],  // conf: -0.285
  ["H080046", "Cloudy skies with a few snow showers after midnight"],  // conf: -0.305
  ["H080047", "Cloudy skies with a few snow showers this afternoon"],  // conf: -0.405
  ["H080048", "Cloudy skies with some morning fog"],  // conf: -0.351
  ["H080049", "Cloudy this evening with showers after midnight"],  // conf: -0.314
  ["H080050", "Cloudy with light rain developing after midnight"],  // conf: -0.309
  ["H080051", "Cloudy with occasional showers late at night"],  // conf: -0.317
  ["H080052", "Cloudy with periods of drizzle"],  // conf: -0.38
  ["H080053", "Cloudy with periods of rain and freezing rain"],  // conf: -0.282
  ["H080054", "Cloudy with periods of snow after midnight"],  // conf: -0.284
  ["H080055", "Cloudy with rain and snow in the morning, rain and snow will become intermittent in the afternoon"],  // conf: -0.274
  ["H080056", "Cloudy with snow showers evolving into a steady snow"],  // conf: -0.27
  ["H080057", "Cloudy periods of rain early"],  // conf: -0.418
  ["H080058", "Considerable cloudiness. Occasional rain showers in the afternoon"],  // conf: -0.311
  ["H080059", "Decreasing cloudiness and windy"],  // conf: -0.348
  ["H080060", "Foggy early, becoming sunny this afternoon"],  // conf: -0.381
  ["H080061", "Foggy early, then partly cloudy for the afternoon"],  // conf: -0.28
  ["H080062", "Foggy this morning than partly cloudy this afternoon"],  // conf: -0.288
  ["H080063", "Foggy with Drizzle developing later during the night"],  // conf: -0.351
  ["H080064", "Frequent rain showers will be accompanied by heavy downpours and strong gusty winds at times"],  // conf: -0.176
  ["H080065", "Heavy snow this evening will taper to snow showers overnight"],  // conf: -0.282
  ["H080066", "Heavy snow this evening will transition to snow showers overnight"],  // conf: -0.229
  ["H080067", "Heavy snow this morning will taper to snow showers this afternoon"],  // conf: -0.222
  ["H080068", "Heavy snow this morning will transition to snow showers this afternoon"],  // conf: -0.215
  ["H080069", "Icy conditions with periods of freezing rain"],  // conf: -0.236
  ["H080070", "Increasing clouds with showers arriving sometime in the afternoon"],  // conf: -0.314
  ["H080071", "Isolated thunderstorms during the evening, becoming fair overnight"],  // conf: -0.282
  ["H080072", "Isolated thunderstorms during the evening, then skies turning mostly clear overnight"],  // conf: -0.253
  ["H080073", "Isolated thunderstorms early, becoming mostly clear after midnight"],  // conf: -0.263
  ["H080074", "Isolated thunderstorms this evening, then skies turning mostly clear after midnight"],  // conf: -0.301
  ["H080075", "Low Clouds and Fog"],  // conf: -0.55
  ["H080076", "Mainly clear"],  // conf: -0.574
  ["H080077", "Mainly cloudy with snow showers around in the morning"],  // conf: -0.309
  ["H080078", "Mixed clouds and sun this morning. Scattered thunderstorms developing this afternoon"],  // conf: -0.3
  ["H080079", "Morning fog than mostly cloudy in the afternoon"],  // conf: -0.342
  ["H080080", "Morning fog, then showers and possibly a thunderstorm in the afternoon"],  // conf: -0.281
  ["H080081", "Morning Sunshine will give way to isolated thunderstorms this afternoon"],  // conf: -0.293
  ["H080082", "Mostly clear and windy"],  // conf: -0.452
  ["H080083", "Mostly cloudy during the evening, a few showers developing later at night"],  // conf: -0.227
  ["H080084", "Mostly cloudy early, isolated thunderstorms may develop this afternoon"],  // conf: -0.235
  ["H080085", "Mostly cloudy early, scattered thunderstorms this afternoon. Some storms could be strong to perhaps severe"],  // conf: -0.219
  ["H080086", "Mostly cloudy skies this evening, a few showers developing overnight"],  // conf: -0.234
  ["H080087", "Mostly cloudy skies with a few showers this afternoon"],  // conf: -0.313
  ["H080088", "Mostly cloudy skies, with scattered thunderstorms developing this afternoon. Some of the storms may become severe"],  // conf: -0.267
  ["H080089", "Mostly cloudy skies with some morning fog"],  // conf: -0.345
  ["H080090", "Mostly cloudy with some showers late"],  // conf: -0.35
  ["H080091", "Mostly sunny and windy"],  // conf: -0.49
  ["H080092", "Occasional light rain tapering to a few showers"],  // conf: -0.314
  ["H080093", "Occasional snow showers and heavier snow squalls"],  // conf: -0.291
  ["H080094", "Occasional thunderstorms storm strong to possibly severe"],  // conf: -0.321
  ["H080095", "Partial cloudiness early, with scattered showers and thunderstorms during the afternoon"],  // conf: -0.277
  ["H080096", "Partly cloudy early, followed by scattered thunderstorms this afternoon"],  // conf: -0.313
  ["H080097", "Partly cloudy in the evening, some showers of rain and snow mixed after midnight"],  // conf: -0.221
  ["H080098", "Partly cloudy skies during the morning hours will become overcast in the afternoon"],  // conf: -0.21
  ["H080099", "Partly cloudy skies this evening, a few showers may develop overnight"],  // conf: -0.325
  ["H080100", "Partly cloudy skies this evening, a few snow showers may develop overnight"],  // conf: -0.252
  ["H080101", "Partly cloudy this morning and becoming cloudy during the afternoon"],  // conf: -0.276
  ["H080102", "Partly cloudy with a late night shower or thunderstorm"],  // conf: -0.274
  ["H080103", "Partly cloudy with a slight chance of showers and thunderstorms, mainly early"],  // conf: -0.301
  ["H080104", "Partly cloudy with a slight chance of showers and thunderstorms, mainly this evening"],  // conf: -0.242
  ["H080105", "Partly cloudy with a slight chance of thunderstorms overnight"],  // conf: -0.223
  ["H080106", "Partly cloudy, with isolated thunderstorms developing this afternoon"],  // conf: -0.3
  ["H080107", "Partly cloudy with scattered thunderstorms overnight. Storms could be strong and perhaps severe"],  // conf: -0.231
  ["H080108", "Partly cloudy with scattered thunderstorms. A few storms may be strong to possibly severe this afternoon"],  // conf: -0.274
  ["H080109", "Partly to mostly cloudy and windy"],  // conf: -0.354
  ["H080110", "Partly to mostly cloudy skies with scattered showers or thunderstorms, mainly before midnight"],  // conf: -0.255
  ["H080111", "Partly to mostly cloudy with a slight chance of showers and thunderstorms in the afternoon"],  // conf: -0.252
  ["H080112", "Partly to mostly cloudy with scattered showers and thunderstorms in the afternoon"],  // conf: -0.251
  ["H080113", "Partly to mostly cloudy with snow showers, especially overnight"],  // conf: -0.342
  ["H080115", "Partly to mostly cloudy, with widely scattered showers or thunderstorms possible this afternoon"],  // conf: -0.242
  ["H080116", "Periods of light wind reprecipitation"],  // conf: -0.353
  ["H080117", "Periods of rain and freezing rain"],  // conf: -0.307
  ["H080118", "Periods of rain and snow windy"],  // conf: -0.377
  ["H080119", "Periods of rain with a few thunderstorms likely"],  // conf: -0.298
  ["H080120", "Periods of rain, rain becoming heavy at times late"],  // conf: -0.293
  ["H080121", "Periods of rain. Rain will be heavy at times in the afternoon"],  // conf: -0.244
  ["H080122", "Periods of rain, some icy conditions developing in the afternoon"],  // conf: -0.308
  ["H080123", "Periods of rain, some icy conditions developing late"],  // conf: -0.249
  ["H080124", "Periods of rain, some icy conditions developing overnight"],  // conf: -0.249
  ["H080125", "Rain and snow in the evening transitioning to snow showers late"],  // conf: -0.263
  ["H080126", "Rain and snow showers in the morning, changing to mainly rain showers in the afternoon"],  // conf: -0.279
  ["H080127", "Rain and snow showers in the morning, changing to rain showers in the afternoon"],  // conf: -0.213
  ["H080128", "Snow and gusty winds will lead to blizzard conditions at times"],  // conf: -0.186
  ["H080129", "Snow and gusty winds, snow will be heavy at times with gusty winds creating blizzard conditions"],  // conf: -0.3
  ["H080130", "Snow during the morning will give way to lingering snow showers during the afternoon"],  // conf: -0.261
  ["H080132", "Snow in the evening will become a mix of wintery precipitation overnight"],  // conf: -0.261
  ["H080133", "Snow showers and locally heavy snow squalls"],  // conf: -0.315
  ["H080134", "Snow showers and occasional heavier snow squalls"],  // conf: -0.354
  ["H080135", "Snow showers and some locally heavier snow squalls"],  // conf: -0.295
  ["H080136", "Snow showers early, peaks of sunshine later"],  // conf: -0.345
  ["H080137", "Snow showers in the morning will give way to a mixture of rain and snow for the afternoon"],  // conf: -0.235
  ["H080138", "Snow showers this evening, breaks in the overcast later"],  // conf: -0.28
  ["H080139", "Snow this morning will become a mix of wintery precipitation for the afternoon"],  // conf: -0.294
  ["H080140", "Snow this morning will give way to lingering snow showers this afternoon"],  // conf: -0.281
  ["H080141", "Snow will be heavy at times along with gusty winds creating blizzard conditions"],  // conf: -0.239
  ["H080142", "Snow will be heavy at times. Gusty winds will create blizzard conditions, especially this evening"],  // conf: -0.278
  ["H080143", "Snow, heavy at times, gusty winds will lead to blizzard conditions, especially this afternoon"],  // conf: -0.295
  ["H080144", "Snow, heavy at times, gusty winds will lead to blizzard conditions"],  // conf: -0.233
  ["H080145", "Some clouds and possibly an isolated thunderstorm this afternoon"],  // conf: -0.316
  ["H080146", "Some drizzle around early, then the chance of a few showers this afternoon"],  // conf: -0.299
  ["H080147", "Some sunshine with a thunderstorm or two possible this afternoon"],  // conf: -0.335
  ["H080148", "Strong thunderstorms likely. Heavy downpours and severe weather are possible"],  // conf: -0.273
  ["H080149", "Sunny skies this morning, then scattered thunderstorms during the afternoon. Some storms will be strong to perhaps severe"],  // conf: -0.325
  ["H080150", "Sunshine in the morning, followed by mostly cloudy skies during the afternoon"],  // conf: -0.267
  ["H080151", "Sunshine this morning. Scattered thunderstorms developing this afternoon. Some stronger storms could produce severe weather"],  // conf: -0.257
  ["H080152", "Thunderstorms, some locally heavy downpours are possible, especially overnight"],  // conf: -0.226
  ["H080153", "Thunderstorms during the evening, then becoming mostly clear overnight"],  // conf: -0.25
  ["H080154", "Thunderstorms with locally heavy downpours"],  // conf: -0.274
  ["H080155", "Thunderstorms accompanied by locally heavy rainfall at times"],  // conf: -0.234
  ["H080156", "Variable clouds with a slight chance of thunderstorms overnight"],  // conf: -0.202
  ["H080157", "Variable clouds with scattered showers or thunderstorms, mainly during the afternoon hours"],  // conf: -0.228
  ["H080158", "Variable clouds with scattered showers or thunderstorms, mainly overnight"],  // conf: -0.25
  ["H080159", "Variable clouds with scattered thunderstorms, especially during the afternoon hours"],  // conf: -0.153
  ["H080160", "Variable clouds with scattered thunderstorms, especially during the evening"],  // conf: -0.275
  ["H080161", "Variable clouds with scattered thunderstorms, especially overnight"],  // conf: -0.283
  ["H080162", "Variable clouds with scattered thunderstorms. A few will be strong to perhaps severe this evening"],  // conf: -0.288
  ["H080163", "Variable clouds with scattered thunderstorms. Storms could be strong and even severe early"],  // conf: -0.252
  ["H080164", "Windy with a wintry mix of precipitation"],  // conf: -0.289
  ["H080165", "Windy with occasional rain"],  // conf: -0.459
  ["H080166", "Windy with periods of light snow"],  // conf: -0.355
  ["H080167", "Windy with periods of rain that will be accompanied by heavy downpours and strong wind gusts at times"],  // conf: -0.205
  ["H080168", "Windy with scattered thunderstorms during the morning. Storms becoming more numerous this afternoon with locally heavy downpours likely"],  // conf: -0.233
  ["H080169", "Windy with scattered thunderstorms this evening, storms becoming more numerous late, with locally heavy downpours likely"],  // conf: -0.246
  ["H080170", "Windy with scattered thunderstorms, a few possibly severe"],  // conf: -0.306
  ["H080171", "Windy with snowshowers"],  // conf: -0.522
  ["H080172", "Windy with thunderstorms. Storms will be strong to possibly severe"],  // conf: -0.259
  ["H080173", "Windy with thunderstorms accompanied by heavy downpours at times"],  // conf: -0.244
  ["H080174", "Windy, a few snow showers are possible"],  // conf: -0.312
  ["H080175", "Windy, a mixture of rain and snow in the morning, will change to all rain in the afternoon"],  // conf: -0.211
  ["H080176", "Windy, a shower or two around early, then partly cloudy overnight"],  // conf: -0.257
  ["H080177", "Windy, heavy snow this evening will give way to a wintery mix overnight"],  // conf: -0.259
  ["H080178", "Windy heavy snow this evening will give way to snow showers overnight"],  // conf: -0.275
  ["H080179", "Windy heavy snow this morning will give way to snow showers this afternoon"],  // conf: -0.282
  ["H080180", "Windy. Mostly cloudy skies will become partly cloudy this afternoon"],  // conf: -0.226
  ["H080181", "Windy rain and snow in the morning will become mainly light rain in the afternoon"],  // conf: -0.209
  ["H080182", "Windy, snow and blizzard conditions ending this evening, followed by clearing overnight"],  // conf: -0.343
  ["H080183", "A few clouds"],  // conf: -0.484
  ["H080184", "A few showers early with isolated thunderstorms developing in the afternoon"],  // conf: -0.236
  ["H080185", "A few showers early, followed by isolated thunderstorms in the afternoon"],  // conf: -0.232
  ["H080186", "Chance of a few showers this evening than mostly clear conditions overnight"],  // conf: -0.263
  ["H080187", "A mix of clouds and sun in the morning will give way to the chance of a few snow showers during the afternoon"],  // conf: -0.148
  ["H080188", "A few evening clouds otherwise generally clear"],  // conf: -0.298
  ["H080191", "Mainly cloudy with a mixture of rain and snow showers developing overnight"],  // conf: -0.29
  ["H080193", "Cloudy with occasional showers overnight"],  // conf: -0.365
  ["H080194", "Cloudy with rain developing after midnight"],  // conf: -0.317
  ["H080195", "Cloudy snow flurries this afternoon"],  // conf: -0.398
  ["H080196", "Cloudy with snow showers transitioning to a steady light snow for the afternoon"],  // conf: -0.263
  ["H080197", "Cloudy with snow showers early and a steady light snow after midnight"],  // conf: -0.274
  ["H080199", "Cloudy snow likely this afternoon"],  // conf: -0.401
  ["H080200", "Cloudy, snow showers developing in the afternoon"],  // conf: -0.41
  ["H080201", "Partly cloudy skies early will give way to clear skies later at night"],  // conf: -0.266
  ["H080202", "Snow showers early will taper to scattered flurries in the afternoon"],  // conf: -0.249
  ["H080203", "Snow showers this evening will taper to scattered flurries overnight"],  // conf: -0.226
  ["H080205", "A few evening clouds, otherwise mainly clear skies"],  // conf: -0.369
  ["H080207", "Mainly cloudy with showers arriving overnight"],  // conf: -0.395
  ["H080208", "Isolated thunderstorms during the evening followed by a chance of showers overnight"],  // conf: -0.237
  ["H080209", "An isolated thunderstorm possible during the evening, then mainly cloudy overnight"],  // conf: -0.31
  ["H080210", "Isolated thunderstorms in the morning, then partly cloudy in the afternoon"],  // conf: -0.23
  ["H080211", "Light snow during the morning will give way to showers of rain and wet snow during the afternoon"],  // conf: -0.24
  ["H080212", "Light snow in the evening will transition to snow showers overnight"],  // conf: -0.241
  ["H080213", "Light snow in the evening will give way to snow showers overnight"],  // conf: -0.255
  ["H080214", "Light snow this evening will transition to snow showers overnight"],  // conf: -0.254
  ["H080215", "Light snow this evening will give way to snow showers overnight"],  // conf: -0.227
  ["H080216", "Mainly clear early than a few clouds later on"],  // conf: -0.32
  ["H080218", "Mostly cloudy skies early, a few snow showers developing in the afternoon"],  // conf: -0.226
  ["H080219", "Mostly cloudy skies with a few snow showers this afternoon"],  // conf: -0.279
  ["H080220", "Mostly cloudy with snow showers mainly during the evening"],  // conf: -0.36
  ["H080221", "Mostly cloudy with snow showers mainly during the morning"],  // conf: -0.324
  ["H080222", "Mostly cloudy, rain and snow showers this morning. A few rain showers in the afternoon"],  // conf: -0.257
  ["H080223", "Mostly sunny in the morning with isolated thunderstorms developing in the afternoon"],  // conf: -0.219
  ["H080224", "Mostly sunny skies with gusty winds developing in the afternoon"],  // conf: -0.267
  ["H080225", "Sun in a few clouds with gusty winds"],  // conf: -0.315
  ["H080226", "Some clouds early, mostly sunny skies along with windy conditions this afternoon"],  // conf: -0.258
  ["H080227", "Sunshine and some clouds"],  // conf: -0.446
  ["H080228", "Partly cloudy early, mostly sunny with gusty winds this afternoon"],  // conf: -0.238
  ["H080229", "Some clouds early, mostly sunny along with windy conditions during the afternoon"],  // conf: -0.237
  ["H080230", "Partly cloudy skies this morning will give way to mainly sunny skies this afternoon"],  // conf: -0.244
  ["H080231", "Overcast skies and windy"],  // conf: -0.376
  ["H080232", "Partly cloudy early, followed by thunderstorms this afternoon. Some storms will be strong to perhaps severe"],  // conf: -0.289
  ["H080233", "Partly cloudy in the morning, followed by thunderstorms in the afternoon. Some storms will be strong to perhaps severe"],  // conf: -0.234
  ["H080234", "Partly cloudy skies during the evening will give way to the chance of a few snow showers after midnight"],  // conf: -0.214
  ["H080235", "Partly cloudy skies during the morning hours strong to perhaps severe thunderstorms will develop in the afternoon"],  // conf: -0.231
  ["H080236", "Partly cloudy skies this evening. A few snow showers may develop in the afternoon"],  // conf: -0.27
  ["H080237", "Partly cloudy skies this morning, strong to perhaps severe thunderstorms will develop during the afternoon"],  // conf: -0.189
  ["H080238", "Partly cloudy skies, gusty winds during the evening"],  // conf: -0.29
  ["H080239", "Partly cloudy skies this evening, a few snow showers may develop after midnight"],  // conf: -0.257
  ["H080240", "Partly to mostly cloudy skies with scattered showers or thunderstorms, mainly in the morning"],  // conf: -0.298
  ["H080241", "Windy with snow, heavy at times"],  // conf: -0.327
  ["H080242", "Rain and snow showers in the evening, transitioning to snow showers overnight"],  // conf: -0.249
  ["H080243", "Rain and snow showers in the morning, the rain and snow will change to rain showers in the afternoon"],  // conf: -0.261
  ["H080244", "Rain and snow showers this evening, transitioning to snow showers overnight"],  // conf: -0.27
  ["H080245", "Rain and snow showers this morning, a shower or two in the afternoon, otherwise mostly cloudy"],  // conf: -0.296
  ["H080246", "Rain and wind"],  // conf: -0.575
  ["H080247", "Rain likely with a few thunderstorms"],  // conf: -0.32
  ["H080248", "Rain showers early will evolve into a more steady rain for the afternoon"],  // conf: -0.235
  ["H080249", "Rain showers this evening with mostly clear conditions overnight"],  // conf: -0.258
  ["H080250", "Rain showers this evening with mostly cloudy conditions overnight"],  // conf: -0.289
  ["H080251", "Scattered showers in the morning, then a slight chance of thunderstorms in the afternoon"],  // conf: -0.192
  ["H080252", "Scattered snow flurries and snow showers before noon, becoming partly cloudy later"],  // conf: -0.209
  ["H080253", "Scattered thunderstorms in the morning, then partly cloudy in the afternoon"],  // conf: -0.228
  ["H080254", "Scattered thunderstorms in the morning, then partly cloudy for the afternoon"],  // conf: -0.202
  ["H080255", "Scattered thunderstorms, especially in the morning"],  // conf: -0.23
  ["H080256", "Scattered thunderstorms, some possibly severe during the evening than partly cloudy overnight"],  // conf: -0.299
  ["H080257", "Scattered thunderstorms, some strong to even severe during the evening, then partly cloudy skies overnight"],  // conf: -0.25
  ["H080258", "Scattered thunderstorms, some strong and possibly severe during the evening will give way to partly cloudy skies after midnight"],  // conf: -0.266
  ["H080259", "Scattered thunderstorms, some strong to even severe this evening, then partly cloudy skies after midnight"],  // conf: -0.251
  ["H080260", "Windy, a shower or two early, will evolve into a steady light rain later at night"],  // conf: -0.191
  ["H080261", "Windy, a shower or two early, will evolve into a steady light rain in the afternoon"],  // conf: -0.238
  ["H080262", "A shower or two possible early, then scattered thunderstorms developing in the afternoon"],  // conf: -0.271
  ["H080263", "Showers early, then clearing overnight"],  // conf: -0.389
  ["H080264", "Showers early, then cloudy overnight"],  // conf: -0.437
  ["H080265", "Showers early, then partly cloudy overnight"],  // conf: -0.429
  ["H080266", "Showers in the evening with some clearing overnight"],  // conf: -0.294
  ["H080267", "Showers in the evening than partly cloudy overnight"],  // conf: -0.311
  ["H080268", "Showers in the morning, then partly cloudy in the afternoon"],  // conf: -0.254
  ["H080269", "A shower or two possible in the evening, then clearing overnight"],  // conf: -0.309
  ["H080270", "A shower or two in the evening, then cloudy overnight"],  // conf: -0.328
  ["H080271", "Showers in the morning with isolated thunderstorms in the afternoon"],  // conf: -0.268
  ["H080272", "A shower or two around in the morning with isolated thunderstorms in the afternoon"],  // conf: -0.253
  ["H080273", "A shower or two in the morning, then cloudy in the afternoon"],  // conf: -0.248
  ["H080274", "A shower or two possible this morning, then scattered thunderstorms developing during the afternoon"],  // conf: -0.289
  ["H080275", "Periods of snow, heavy at times, along with gusty winds"],  // conf: -0.251
  ["H080276", "Snow and gusty winds, snow will become heavy during the afternoon"],  // conf: -0.3
  ["H080277", "Snow and gusty winds, snow will become heavy overnight"],  // conf: -0.316
  ["H080278", "Snow and gusty winds snow will become heavy this afternoon"],  // conf: -0.331
  ["H080279", "Snow during the morning will become heavy at times during the afternoon"],  // conf: -0.209
  ["H080280", "Snow during the morning will taper off to light snow during the afternoon"],  // conf: -0.211
  ["H080281", "Snow in the evening will become heavy at times overnight"],  // conf: -0.332
  ["H080282", "Snow showers early with a steadier snow developing in the afternoon"],  // conf: -0.232
  ["H080283", "Snow showers early with a steadier snow developing for the afternoon"],  // conf: -0.276
  ["H080284", "Snow showers this morning, bright sunshine for the afternoon"],  // conf: -0.311
  ["H080285", "Snow this evening will become heavy at times overnight"],  // conf: -0.307
  ["H080286", "Snow this evening will become lighter overnight"],  // conf: -0.369
  ["H080287", "Snow this evening will taper off to light snow overnight"],  // conf: -0.306
  ["H080288", "Snow this morning will become heavy at times this afternoon"],  // conf: -0.298
  ["H080289", "Snow will become heavy at times during the afternoon"],  // conf: -0.307
  ["H080290", "Snow will become heavy at times overnight"],  // conf: -0.323
  ["H080291", "Snow. Snow will be heavy at times during the morning"],  // conf: -0.332
  ["H080292", "Snow. Snow will be heavy at times in the evening"],  // conf: -0.307
  ["H080293", "Snow. Snow will be heavy at times this evening"],  // conf: -0.322
  ["H080294", "Snow. Snow will be heavy at times this morning"],  // conf: -0.354
  ["H080295", "Snow and windy. Snow will become heavy at times during the afternoon"],  // conf: -0.287
  ["H080296", "Snow and windy snow will become heavy at times this afternoon"],  // conf: -0.337
  ["H080297", "Some clouds and possibly an isolated thunderstorm in the afternoon"],  // conf: -0.372
  ["H080298", "Steady light rain this morning, showers continuing this afternoon"],  // conf: -0.34
  ["H080299", "Windy, sunshine will give way to some afternoon clouds"],  // conf: -0.284
  ["H080300", "Sunny and windy"],  // conf: -0.65
  ["H080301", "Sunny skies with gusty winds developing in the afternoon"],  // conf: -0.28
  ["H080302", "Sunny skies becoming windy"],  // conf: -0.542
  ["H080303", "Sunny skies, gusty winds during the morning"],  // conf: -0.365
  ["H080304", "Sunny skies, gusty winds in the morning"],  // conf: -0.385
  ["H080305", "Sunny becoming windy"],  // conf: -0.575
  ["H080306", "Sunny, gusty winds diminishing during the afternoon"],  // conf: -0.373
  ["H080307", "Sunny windy during the morning"],  // conf: -0.448
  ["H080308", "A good deal of sunshine"],  // conf: -0.453
  ["H080309", "Thunderstorms, some strong to perhaps severe during the evening than partly cloudy overnight"],  // conf: -0.399
  ["H080310", "Thunderstorms, some strong to perhaps severe early, then partly cloudy after midnight"],  // conf: -0.325
  ["H080311", "Thunderstorms, some strong to perhaps severe in the evening will give way to partly cloudy skies overnight"],  // conf: -0.234
  ["H080312", "Thunderstorms, some strong to perhaps severe this evening, then skies turning partly cloudy after midnight"],  // conf: -0.242
  ["H080313", "Variable clouds with scattered thunderstorms"],  // conf: -0.341
  ["H080314", "Windy with showers and thunderstorms. Some storms could be strong to perhaps severe"],  // conf: -0.239
  ["H080315", "Variable clouds with showers and thunderstorms becoming likely. Some storms will be strong to perhaps severe"],  // conf: -0.261
  ["H080316", "A stray thunderstorm or two this evening, otherwise partly cloudy"],  // conf: -0.245
  ["H080317", "Windy with some rain showers"],  // conf: -0.422
  ["H080319", "Windy early with rain showers mixing with snow showers later at night"],  // conf: -0.263
  ["H080320", "Showers and thunderstorms becoming likely. Some storms will be strong to perhaps severe"],  // conf: -0.261
  ["H080321", "Rain and snow showers mixed in the afternoon"],  // conf: -0.346
  ["H080322", "Rain and snow this evening, transitioning to snow showers overnight"],  // conf: -0.249
  ["H080323", "Rain showers early, changing to mixed rain and snow later at night"],  // conf: -0.198
  ["H080324", "Rain showers early with overcast skies later in the day"],  // conf: -0.269
  ["H080325", "Rain heavy at times"],  // conf: -0.541
  ["H080326", "Scattered clouds with the possibility of an isolated thunderstorm developing this afternoon"],  // conf: -0.231
  ["H080327", "Scattered showers or thunderstorms, especially before midnight"],  // conf: -0.27
  ["H080328", "Scattered thunderstorms during the evening, followed by a few showers overnight"],  // conf: -0.25
  ["H080329", "Scattered thunderstorms early, mainly cloudy overnight with a few showers"],  // conf: -0.232
  ["H080330", "Scattered thunderstorms early, some storms could be severe, then showers and thunderstorms likely overnight"],  // conf: -0.231
  ["H080331", "Scattered thunderstorms in the evening, with a few showers possible later at night"],  // conf: -0.189
  ["H080332", "Scattered thunderstorms in the evening, mainly cloudy later at night with a few showers"],  // conf: -0.192
  ["H080333", "Scattered thunderstorms in the morning, becoming more widespread in the afternoon, heavy downpours are possible"],  // conf: -0.239
  ["H080334", "Scattered thunderstorms this evening followed by a few showers overnight"],  // conf: -0.256
  ["H080335", "Scattered thunderstorms this evening with a few showers possible overnight"],  // conf: -0.27
  ["H080336", "Scattered thunderstorms this evening, some possibly severe, will be followed by showery rains and possibly a thunderstorm or two overnight"],  // conf: -0.239
  ["H080337", "Scattered thunderstorms this morning. Then thunderstorms more likely during the afternoon hours. Some storms will be strong to perhaps severe"],  // conf: -0.234
  ["H080338", "Scattered thunderstorms, especially during the afternoon hours, when a few storms could be severe"],  // conf: -0.227
  ["H080339", "Scattered thunderstorms, especially during the afternoon hours"],  // conf: -0.227
  ["H080340", "Scattered thunderstorms, especially overnight"],  // conf: -0.362
  ["H080341", "Scattered thunderstorms. Some storms may be strong and perhaps severe during the evening"],  // conf: -0.309
  ["H080342", "Showers and a few thunderstorms likely"],  // conf: -0.25
  ["H080343", "Showers and possibly a thunderstorm during the evening. Fog may develop overnight"],  // conf: -0.328
  ["H080344", "Showers and thundershowers likely this evening with a shower or two possible overnight"],  // conf: -0.324
  ["H080345", "Showers and thunderstorms, some locally heavy downpours are possible, especially during the afternoon hours"],  // conf: -0.242
  ["H080346", "Showers and thunderstorms likely"],  // conf: -0.299
  ["H080347", "Showers and thunderstorms likely. Thunderstorms could be strong and possibly severe during the afternoon hours"],  // conf: -0.253
  ["H080348", "Showers and thunderstorms"],  // conf: -0.377
  ["H080349", "Showers, and thunderstorms. Storms can be strong and possibly severe during the afternoon"],  // conf: -0.288
  ["H080350", "Showers and thunderstorms. Storms could be strong and possibly severe during the afternoon hours"],  // conf: -0.235
  ["H080351", "Showers early, with strong to perhaps severe thunderstorms developing this afternoon"],  // conf: -0.21
  ["H080352", "Showers early, then cloudy in the afternoon"],  // conf: -0.39
  ["H080353", "Showers likely and possibly a thunderstorm during the evening, then some lingering showers still possible overnight"],  // conf: -0.214
  ["H080354", "Showers of rain and wet snow in the evening will become a light wintery mix later at night"],  // conf: -0.292
  ["H080355", "Showers this morning with scattered thunderstorms during the afternoon hours. Some storms will be strong to possibly severe"],  // conf: -0.169
  ["H080356", "Showers this morning, then strong to perhaps severe thunderstorms during the afternoon hours"],  // conf: -0.327
  ["H080357", "Showers with a possible thunderstorm in the evening, then variable clouds overnight with still a chance of showers"],  // conf: -0.261
  ["H080358", "Showery rains accompanied by very heavy downpours and strong gusty winds at times early will taper to scattered showers later at night"],  // conf: -0.202
  ["H080359", "Showery rains containing strong, gusty winds and heavy downpours at times"],  // conf: -0.291
  ["H080360", "Showery rains will be accompanied by heavy downpours, thunder and strong gusty winds at times"],  // conf: -0.28
  ["H080361", "Snow along with gusty winds and blizzard conditions at times"],  // conf: -0.213
  ["H080362", "Evening clouds will give way to clearing overnight"],  // conf: -0.283
  ["H080363", "Mostly cloudy early than afternoon sunshine"],  // conf: -0.353
  ["H080364", "A couple of sprinkles early will be followed by afternoon sunshine"],  // conf: -0.193
  ["H080365", "A couple of sprinkles early will be followed by clearing later at night"],  // conf: -0.162
  ["H080366", "A couple of sprinkles early will be followed by overnight clearing"],  // conf: -0.188
  ["H080367", "A couple of sprinkles early will be followed by sunshine for the afternoon"],  // conf: -0.182
  ["H080368", "Evening clouds will give way to clearing"],  // conf: -0.26
  ["H080369", "Morning clouds will give way to afternoon sunshine"],  // conf: -0.31
  ["H080370", "Morning clouds will give way to sunshine for the afternoon"],  // conf: -0.283
  ["H080371", "Mostly cloudy early, then clearing later on"],  // conf: -0.346
  ["H080372", "Mostly cloudy early than clearing overnight"],  // conf: -0.337
  ["H080373", "Mostly cloudy early, then sunshine for the afternoon"],  // conf: -0.327
  ["H080374", "Snow during the morning will transition to snow showers during the afternoon"],  // conf: -0.189
];

// ────────────────────────────────────────────────────────────────────────────
//  AJ composite longform clips (transcribed via Whisper 2026-04-13)
// ────────────────────────────────────────────────────────────────────────────

/**
 * AJ composite longform clips (549 unique phrases, deduped from 1,525 takes).
 * Filenames encode {CCSH_A}{CCSH_B}{variant}{take} — 10 digits.
 * Many variants share text (alternate recordings of same phrase); dedup keeps one.
 * Merged into the findLongformMatch pool so the fuzzy matcher picks them when
 * they score better than N-series phrases against an NWS detailedForecast.
 */
const AJ_COMPOSITE_CLIPS: LfEntry[] = [
  ["0300030011", "Variable clouds with strong thunderstorms"],
  ["0300030012", "Strong thunderstorms likely"],
  ["0300300021", "Thunderstorms, some strong during the evening will give way to partly cloudy skies after midnight"],
  ["0300300022", "Thunderstorm, some strong early than partly cloudy after midnight"],
  ["0300300023", "Thunderstorms, some strong this evening, then skies turning partly cloudy after midnight"],
  ["0300300041", "Thunderstorms, some strong in the evening will give way to partly cloudy skies overnight"],
  ["0300300042", "Thunderstorms, some strong during the evening then partly cloudy overnight"],
  ["0300300043", "Thunderstorms, some strong during the evening, then skies turning partly cloudy overnight"],
  ["0400040011", "Thunderstorms"],
  ["0400040012", "Thunderstorms likely"],
  ["0400117011", "Windy with showers and thunderstorms likely"],
  ["0500050011", "Cloudy with rain and snow"],
  ["0500050012", "Periods of rain and snow"],
  ["0700070011", "Cloudy with snow, sleet or freezing rain"],
  ["0700070012", "Periods of snow, sleet or freezing rain"],
  ["0700070013", "A wintry mix of snow, sleet or freezing rain"],
  ["1100040031", "Rain showers in the morning with thunderstorms developing in the afternoon"],
  ["1100040032", "Rain showers in the morning with numerous thunderstorms developing in the afternoon"],
  ["1100110011", "Overcast with rain showers at times"],
  ["1100110012", "Cloudy with occasional rain showers"],
  ["1100110013", "Cloudy with showers"],
  ["1100110014", "Considerable cloudiness with occasional rain showers"],
  ["1100120011", "Showers this morning becoming a steady rain during the afternoon hours"],
  ["1100120012", "Rain showers early becoming steady by the afternoon"],
  ["1100120021", "Showers this evening becoming a steady rain overnight"],
  ["1100120022", "Rain showers early, becoming steady overnight"],
  ["1100120031", "Showers early, becoming a steady rain later in the day"],
  ["1100120032", "Rain showers in the morning becoming steady in the afternoon"],
  ["1100120041", "Showers early becoming a steady rain late"],
  ["1100120042", "Rain showers in the evening becoming steady overnight"],
  ["1100120121", "Showers this evening becoming a steady light rain overnight"],
  ["1100120122", "Rain showers early, becoming a steady light rain overnight"],
  ["1100120131", "Showers early becoming a steady light rain later in the day"],
  ["1100120132", "Rain showers in the morning becoming a steady light rain in the afternoon"],
  ["1100120141", "Shower is early, becoming a steady light rain late"],
  ["1100120142", "Rain showers in the evening becoming a steady light rain overnight"],
  ["1100260022", "Shower is early than cloudy overnight"],
  ["1100260032", "Showers in the morning, then cloudy in the afternoon"],
  ["1100260042", "Showers in the evening then cloudy overnight"],
  ["1100280021", "Rain showers ending this evening with mostly cloudy conditions overnight"],
  ["1100280022", "Showers ending early with some clearing overnight"],
  ["1100280031", "Rain showers ending early with mostly cloudy conditions later in the day"],
  ["1100280032", "Showers ending in the morning with some clearing in the afternoon"],
  ["1100280041", "Rain showers ending early with mostly cloudy conditions late"],
  ["1100280042", "Showers ending in the evening with some clearing overnight"],
  ["1100300021", "Rain showers ending this evening with clearing overnight"],
  ["1100300022", "Showers ending early, then partly cloudy overnight"],
  ["1100300031", "Rain showers ending early with ample sunshine later in the day"],
  ["1100300032", "Shower is ending in the morning, then partly cloudy in the afternoon"],
  ["1100300041", "Rain showers ending early with clearing later at night"],
  ["1100300042", "Showers ending in the evening, then partly cloudy overnight"],
  ["1100340021", "Rain showers ending this evening with mostly clear conditions overnight"],
  ["1100340022", "Showers early than clearing overnight"],
  ["1100340042", "Showers in the evening then clearing overnight"],
  ["1100370032", "Showers in the morning with isolated thunderstorms arriving in the afternoon"],
  ["1100380011", "Showers this morning then scattered thunderstorms developing during the afternoon hours"],
  ["1100380012", "Rain showers early with scattered thunderstorms arriving by the afternoon"],
  ["1100380031", "Shower is early with scattered thunderstorms developing later in the day"],
  ["1100380032", "Rain showers in the morning with scattered thunderstorms arriving in the afternoon"],
  ["1100460011", "Showers this morning becoming less numerous during the afternoon hours"],
  ["1100460012", "Rain showers early, becoming more intermittent by afternoon"],
  ["1100460021", "Showers this evening becoming less numerous overnight"],
  ["1100460022", "Rain showers early, becoming more intermittent overnight"],
  ["1100460031", "Shower is early, becoming less numerous later in the day"],
  ["1100460032", "Rain showers in the morning becoming more intermittent in the afternoon"],
  ["1100460041", "Showers early becoming less numerous late"],
  ["1100460042", "Rain showers in the evening becoming more intermittent overnight"],
  ["1100490021", "Rain showers this evening mixing with snow showers overnight"],
  ["1100490041", "Rain showers early, mixing with snow showers late"],
  ["1110111011", "Windy with rain showers likely"],
  ["1110111012", "Windy and overcast with showers"],
  ["1110490041", "Windy early with rain showers mixing with snow showers late"],
  ["1140114011", "Showers and thundershowers likely"],
  ["1140380012", "Variable clouds with showers and scattered thunderstorms"],
  ["1200110011", "A steady rain this morning showers continuing this afternoon"],
  ["1200110012", "Rain early, then remaining cloudy with showers in the afternoon"],
  ["1200110021", "A steady rain this evening showers continuing overnight"],
  ["1200110022", "Rain early, then remaining cloudy with showers overnight"],
  ["1200110031", "A steady rain in the morning, showers continuing in the afternoon"],
  ["1200110041", "A steady rain in the evening, showers continuing late"],
  ["1200110042", "Rain early than remaining cloudy with showers late"],
  ["1200120011", "Rain"],
  ["1200120012", "Cloudy with periods of rain"],
  ["1200120013", "Rain likely"],
  ["1200120014", "Periods of Rain"],
  ["1200120111", "Occasional rain"],
  ["1201110011", "Steady light rain this morning, showers continuing this afternoon"],
  ["1201110012", "Light rain early, then remaining cloudy with showers in the afternoon"],
  ["1201110021", "Steady light rained this evening, showers continuing overnight"],
  ["1201110022", "Light rain early, then remaining cloudy with showers overnight"],
  ["1201110031", "Steady light rained in the morning, showers continuing in the afternoon"],
  ["1201110041", "Steady light rain in the evening, showers continuing late"],
  ["1201110042", "Light rain early, then remaining cloudy with showers late"],
  ["1201120111", "Occasional light rain"],
  ["1201120112", "Cloudy with periods of light rain"],
  ["1201120113", "Cloudy with occasional rain throughout the day"],
  ["1201120114", "Cloudy, some light rain will fall throughout the day"],
  ["1201120123", "Cloudy with occasional light rain"],
  ["1201120124", "Cloudy, some light rain is likely"],
  ["1201460012", "A steady light rain early then remaining cloudy with a few showers"],
  ["1210120012", "Cloudy and windy at times with periods of rain"],
  ["1210120014", "Windy at times with periods of rain"],
  ["1210121011", "Rain and wind"],
  ["1210121012", "Cloudy and windy with periods of rain"],
  ["1210121013", "Windy with rain likely"],
  ["1210121014", "Windy with periods of rain"],
  ["1211121111", "Windy with occasional light rain"],
  ["1211121112", "Cloudy and windy with periods of light rain"],
  ["1211121113", "Windy with light rain likely"],
  ["1211121114", "Windy with periods of light rain"],
  ["1240120012", "Rain likely with a few thunderstorms"],
  ["1300130011", "Variably cloudy with light snow flurry as possible"],
  ["1300130012", "Snow flurries or snow showers"],
  ["1300130013", "Often on snow flurries are possible along with variably cloudy skies"],
  ["1400140011", "Mostly cloudy with snow flurries and snow showers possible"],
  ["1400140012", "Occasional snowshowers"],
  ["1400140013", "Variable clouds with numerous snow showers or flurries expected"],
  ["1400140014", "Snow flurries and snow showers"],
  ["1400160013", "Snow showers and a steadier snow developing late"],
  ["1400160032", "Cloudy with snow showers early and steady snow likely later in the day"],
  ["1400160033", "Snow showers and steadier snow developing later in the day"],
  ["1400160114", "Cloudy with snow showers and flurries becoming a steady light snow later"],
  ["1400260012", "Cloudy with snow showers mainly during the morning"],
  ["1400260022", "Cloudy with snow showers mainly during the evening"],
  ["1400280012", "Mostly cloudy with snow showers, mainly during the morning"],
  ["1400280022", "Mostly cloudy with snow showers, mainly during the evening"],
  ["1400300013", "Becoming partly cloudy later with any flurries or snow showers ending by noontime"],
  ["1400300023", "Becoming partly cloudy later, with any flurries or snow showers ending by midnight"],
  ["1400320012", "Snow showers ending bright sunshine later"],
  ["1400410021", "Flurries and snow showers this evening becoming more scattered later"],
  ["1400410022", "Frequent snow showers will become more widely scattered by late night"],
  ["1400410024", "Flurries and some snow showers this evening becoming less likely by morning"],
  ["1400410031", "Flurries and snow showers early, becoming more scattered later"],
  ["1400410032", "Frequent snow showers will become more widely scattered by late in the day"],
  ["1400410034", "Flurries and some snow showers in the morning becoming less likely toward evening"],
  ["1400410042", "Frequent snow showers will become more widely scattered by late at night"],
  ["1400410044", "Flurries and some snow showers in the evening becoming less likely toward morning"],
  ["1400470013", "Snow flurries and snow showers early with a chance of lingering snow showers later"],
  ["1410141011", "Cloudy and blustery with snow showers"],
  ["1410141012", "Windy with occasional snowshowers"],
  ["1410141013", "Cloudy with occasional snow showers, quite windy"],
  ["1410141014", "Pouty with snow showers, risk winds were reduced visibilities in some of the snow showers"],
  ["1410410014", "Mostly cloudy, some flurries or snow showers are possible"],
  ["1600160011", "Snow likely"],
  ["1600160012", "Periods of snow"],
  ["1600160013", "Cloudy with snow"],
  ["1600160121", "Snow this evening will taper off to light snow late"],
  ["1600160122", "Snow this evening will become lighter late"],
  ["1600160131", "Snow during the morning will taper off to light snow during the afternoon"],
  ["1600420011", "Snow this morning will become heavy at times this afternoon"],
  ["1600420012", "Snow will become heavy at times this afternoon"],
  ["1600420021", "Snow this evening will become heavy at times late"],
  ["1600420022", "Snow will become heavy at times late"],
  ["1600420031", "Snow during the morning will become heavy at times during the afternoon"],
  ["1600420032", "Snow will become heavy at times during the afternoon"],
  ["1600420041", "Snow in the evening will become heavy at times overnight"],
  ["1600420042", "Snow will become heavy at times overnight"],
  ["1601140021", "Light snow this evening will give way to snowshowers late"],
  ["1601140022", "Light snow this evening will give way to a few snow showers late"],
  ["1601140031", "Light snow during the morning will give way to snow showers during the afternoon"],
  ["1601140032", "Light snow during the morning will give way to a few snow showers during the afternoon"],
  ["1601140041", "Light snow in the evening will give way to snow showers overnight"],
  ["1601140042", "Light snow in the evening will give way to a few snow showers overnight"],
  ["1601160111", "Cloudy with some light snow"],
  ["1601160112", "Periods of light snow"],
  ["1601490031", "Light snow during the morning will give way to showers of rain and wet snow during the afternoon"],
  ["1610161011", "Periods of snow and windy"],
  ["1610161012", "Snow along with gusty winds at times"],
  ["1610421011", "Snowy and windy, snow will become heavy at times this afternoon"],
  ["1610421012", "Snow and gusty winds, snow will become heavy this afternoon"],
  ["1610421021", "Snowy and windy. Snow will become heavy at times late"],
  ["1610421022", "Snow and gusty winds, snow will become heavy late"],
  ["1610421031", "Snowy and windy. Snow will become heavy at times during the afternoon"],
  ["1610421032", "Snow and gusty winds, snow will become heavy during the afternoon"],
  ["1610421041", "Snowy and windy. Snow will become heavy at times overnight"],
  ["1610421042", "Snow and gusty winds, snow will become heavy overnight"],
  ["2000200011", "Funky"],
  ["2010121111", "Windy, periods of light rain this afternoon"],
  ["2100370032", "A few isolated thunderstorms developing during the afternoon"],
  ["2100490012", "A mix of light rain and snow this afternoon"],
  ["2100490042", "A mix of light rain and snow after midnight"],
  ["2110261011", "Cloudy and Wimby"],
  ["2110281012", "Windy with mostly cloudy skies"],
  ["2600110021", "Cloudy with occasional showers arriving late"],
  ["2600110024", "Considerable cloudiness, occasional rain showers developing after midnight"],
  ["2600120023", "Cloudy with rain developing after midnight"],
  ["2600130012", "Cloudy with snow flurries developing late"],
  ["2600140011", "Cloudy skies with a few afternoon snow showers"],
  ["2600140021", "Cloudy skies with a few late night snow showers"],
  ["2600140022", "Cloudy with snow showers developing after midnight"],
  ["2600140033", "Cloudy, snow showers possible in the afternoon"],
  ["2600160013", "Cloudy snow likely this afternoon"],
  ["2600260011", "Cloudy Skies"],
  ["2600260012", "Cloudy"],
  ["2600260013", "Overcast"],
  ["2600260014", "Generally cloudy"],
  ["2600280011", "Mostly cloudy"],
  ["2600280012", "Mostly cloudy skies"],
  ["2600280013", "Considerable cloudiness"],
  ["2600300011", "Cloudy skies this morning will become partly cloudy this afternoon"],
  ["2600300012", "Cloudy skies early than partly cloudy this afternoon"],
  ["2600300013", "Cloudy skies early followed by partial clearing"],
  ["2600300014", "Cloudy early with peaks of sunshine expected late"],
  ["2600300022", "Cloudy skies early than partly cloudy after midnight"],
  ["2600300031", "Cloudy skies early will become partly cloudy later in the day"],
  ["2600300032", "Cloudy skies early than partly cloudy in the afternoon"],
  ["2600300034", "Cloudy early with partial sunshine expected late"],
  ["2600320011", "Clearing"],
  ["2600320012", "Decreasing cloudiness"],
  ["2600460012", "Cloudy this morning, a few showers developing during the afternoon"],
  ["2600460021", "Cloudy skies with a few showers after midnight"],
  ["2600460022", "Cloudy skies this evening, a few showers developing late"],
  ["2600460031", "Cloudy skies with a few showers later in the day"],
  ["2600460032", "Cloudy skies early, a few showers developing later in the day"],
  ["2600460041", "Cloudy skies with a few showers later at night"],
  ["2600460042", "Cloudy during the evening, a few showers developing late"],
  ["2600470022", "Cloudy skies this evening, a few snow showers developing late"],
  ["2600470031", "Cloudy skies with a few snow showers later in the day"],
  ["2600470032", "Cloudy sky is early, a few snow showers developing later in the day"],
  ["2600470041", "Cloudy skies with a few snow showers later at night"],
  ["2600490021", "Cloudy with a mixture of light rain and snow developing late"],
  ["2610261012", "Cloudy with gusty winds"],
  ["2610261013", "Overcast skies and windy"],
  ["2610281011", "Mostly cloudy and windy"],
  ["2800110024", "Increasing clouds with showers arriving overnight"],
  ["2800260012", "Some early morning breaks in the overcast, otherwise cloudy"],
  ["2800260013", "More clouds than sun"],
  ["2800260014", "Mainly cloudy"],
  ["2800280014", "Mainly cloudy, a few peaks of sunshine possible"],
  ["2800300011", "Mostly cloudy skies this morning will become partly cloudy this afternoon"],
  ["2800300012", "Mostly cloudy skies early, then partly cloudy this afternoon"],
  ["2800300013", "Partly to mostly cloudy"],
  ["2800300014", "Considerable clouds this morning, some decrease in clouds later in the day"],
  ["2800300021", "Mostly cloudy skies this evening will become partly cloudy after midnight"],
  ["2800300022", "Mostly cloudy skies early than partly cloudy after midnight"],
  ["2800300024", "Considerable clouds this evening, some decrease in clouds late"],
  ["2800300031", "Mostly cloudy skies early will become partly cloudy later in the day"],
  ["2800300032", "Mostly cloudy skies early than partly cloudy in the afternoon"],
  ["2800300034", "Considerable clouds early, some decreasing clouds later in the day"],
  ["2800300041", "Mostly cloudy skies early will become partly cloudy late"],
  ["2800300044", "Considerable clouds early, some decrease in clouds late"],
  ["2800460012", "Mostly cloudy this morning, a few showers developing during the afternoon"],
  ["2800460021", "Mostly cloudy skies with a few showers after midnight"],
  ["2800460031", "Mostly cloudy skies with a few showers later in the day"],
  ["2800460032", "Mostly cloudy skies early, a few showers developing later in the day"],
  ["2800460041", "Mostly cloudy skies with a few showers late"],
  ["2800470031", "Mostly cloudy skies with a few snow showers later in the day"],
  ["2800470032", "Mostly cloudy skies early, a few snow showers developing later in the day"],
  ["2800470041", "Mostly cloudy skies with a few snow showers late"],
  ["2800470042", "Mostly cloudy during the evening, a few snow showers developing late"],
  ["2810301012", "Variable cloudiness and windy"],
  ["3000030011", "Partly cloudy skies this morning, strong thunderstorms will develop during the afternoon"],
  ["3000030012", "Partly cloudy early, followed by strong thunderstorms this afternoon"],
  ["3000030013", "A mix of clouds and sun this morning, then strong thunderstorms this afternoon"],
  ["3000030031", "Partly cloudy skies during the morning hours, strong thunderstorms will develop in the afternoon"],
  ["3000030032", "Partly cloudy in the morning followed by strong thunderstorms later in the day"],
  ["3000030033", "Partly cloudy early with strong thunderstorms likely later in the day"],
  ["3000110021", "Partly cloudy skies this evening will give way to occasional showers overnight"],
  ["3000110022", "Partly cloudy skies this evening, increasing clouds with periods of showers late"],
  ["3000110023", "Partly cloudy this evening, followed by increasing clouds with showers developing after midnight"],
  ["3000110031", "Partly cloudy skies during the morning hours will give way to occasional showers in the afternoon"],
  ["3000110032", "Partly cloudy in the morning, increasing clouds with periods of showers later in the day"],
  ["3000110033", "Partly cloudy early, followed by increasing clouds with showers developing later in the day"],
  ["3000110041", "Partly cloudy skies early will give way to occasional showers later during the night"],
  ["3000110042", "Partly cloudy in the evening, increasing clouds with periods of showers after midnight"],
  ["3000110043", "Partly cloudy skies early, followed by increasing clouds with showers developing later at night"],
  ["3000260011", "A mix of clouds and sun early followed by cloudy skies this afternoon"],
  ["3000260012", "Partly cloudy skies this morning will become overcast during the afternoon"],
  ["3000260014", "A mix of clouds and sun during the morning will give way to cloudy skies this afternoon"],
  ["3000260021", "Partly cloudy early, followed by cloudy skies overnight"],
  ["3000260022", "Partly cloudy skies this evening will become overcast overnight"],
  ["3000260023", "Partly cloudy this evening, then becoming cloudy after midnight"],
  ["3000260024", "Partly cloudy skies early will give way to cloudy skies late"],
  ["3000260033", "A mix of clouds and sun early, then becoming cloudy later in the day"],
  ["3000260034", "Partly cloudy skies in the morning will give way to cloudy skies during the afternoon"],
  ["3000260041", "Partly cloudy during the evening followed by cloudy skies overnight"],
  ["3000260042", "Partly cloudy skies early will become overcast later during the night"],
  ["3000260043", "Partly cloudy skies in the evening, then becoming cloudy overnight"],
  ["3000260044", "Partly cloudy skies during the evening will give way to cloudy skies overnight"],
  ["3000280011", "Clouds and some sun this morning with more clouds for this afternoon"],
  ["3000280013", "Some sun this morning with increasing clouds this afternoon"],
  ["3000280021", "Partly cloudy this evening with more clouds for overnight"],
  ["3000280023", "Partly cloudy early with increasing clouds overnight"],
  ["3000280031", "Intervals of clouds and sunshine in the morning with more clouds for later in the day"],
  ["3000280033", "Some set in the morning with increasing clouds during the afternoon"],
  ["3000280041", "Clear to partly cloudy in the evening with more clouds for later at night"],
  ["3000300011", "A mix of clouds and sun"],
  ["3000300012", "Sunshine along with a few clouds"],
  ["3000300013", "Sun along with patchy clouds"],
  ["3000300014", "Partly cloudy"],
  ["3000300021", "Partly cloudy skies"],
  ["3000300022", "Clear to partly cloudy"],
  ["3000300023", "Cloudy intervals"],
  ["3000300024", "Some clouds"],
  ["3000300031", "Intervals of clouds and sunshine"],
  ["3000300034", "Sunshine along with some passing clouds"],
  ["3000300041", "Clear to partly cloudy skies"],
  ["3000300042", "A few clouds from time to time"],
  ["3000300043", "A few clouds"],
  ["3000301032", "Wind increasing, a few clouds from time to time"],
  ["3000320011", "Mostly sunny"],
  ["3000320012", "A few clouds this morning but generally sunny"],
  ["3000320013", "A mix of clouds and sun this morning with more sunshine this afternoon"],
  ["3000320021", "Mainly clear"],
  ["3000320022", "A few clouds this evening but mainly clear"],
  ["3000320023", "Generally clear skies"],
  ["3000320024", "Generally fair skies"],
  ["3000320031", "Mainly sunny"],
  ["3000320032", "A few clouds in the morning, but mainly sunny"],
  ["3000320033", "Clouds and sun mixed in the morning, then generally sunny for the afternoon"],
  ["3000320034", "A few clowns in the morning, otherwise sunny"],
  ["3000320041", "Fair Skies!"],
  ["3000320042", "A few clouds early, but generally clear"],
  ["3000320044", "Fair to partly cloudy"],
  ["3000321011", "Mostly sunny with gusty winds developing this afternoon"],
  ["3000321012", "Mostly sunny skies, becoming windy late"],
  ["3000321031", "Mostly sunny skies with gusty winds developing later in the day"],
  ["3000321032", "Mostly sunny, becoming windy during the afternoon"],
  ["3000340022", "Some passing clouds"],
  ["3000340031", "Sunshine along with some cloudy intervals"],
  ["3000340032", "A few clouds early, otherwise mostly sunny"],
  ["3000340033", "Sun and a few passing clouds"],
  ["3000340034", "A few passing clouds, otherwise generally sunny"],
  ["3000370031", "A mix of clouds and sun with a chance of an isolated thunderstorm in the afternoon"],
  ["3000370032", "Some clouds and possibly an isolated thunderstorm in the afternoon"],
  ["3000370033", "Sun and clouds mixed with a slight chance of thunderstorms during the afternoon"],
  ["3000370034", "Scattered clouds with the possibility of an isolated thunderstorm developing during the afternoon"],
  ["3000380014", "Partly cloudy with afternoon thunderstorms"],
  ["3000380031", "Partial cloudiness early with scattered showers and thunderstorms in the afternoon"],
  ["3000380032", "Partly cloudy in the morning, followed by scattered thunderstorms later in the day"],
  ["3000380033", "Partly cloudy early, scattered thunderstorms developing later in the day"],
  ["3000460021", "Partly cloudy this evening followed by mostly cloudy skies and a few showers after midnight"],
  ["3000460022", "Partly cloudy skies during the evening giving way to a few showers after midnight"],
  ["3000460031", "Partly cloudy early followed by mostly cloudy skies and a few showers later in the day"],
  ["3000460032", "A mix of clouds and sun in the morning giving way to a few showers during the afternoon"],
  ["3000460033", "Partly cloudy skies early, a few showers developing later in the day"],
  ["3000460041", "Partly cloudy skies early, followed by mostly cloudy skies and a few showers later at night"],
  ["3000460042", "Partly cloudy skies early, giving way to a few showers after midnight"],
  ["3000460043", "Partly cloudy during the evening, a few showers developing later during the night"],
  ["3000470021", "Partly cloudy this evening, followed by mostly cloudy skies and a few snow showers after midnight"],
  ["3000470022", "Partly cloudy skies during the evening, giving way to a few snow showers after midnight"],
  ["3000470032", "A mix of clouds and sun in the morning giving way to a few snow showers during the afternoon"],
  ["3000470033", "Partly cloudy skies early, a few snow showers developing later in the day"],
  ["3000470041", "Partly cloudy skies early, followed by mostly cloudy skies and a few snow showers later at night"],
  ["3000470042", "Partly cloudy skies early, giving way to a few snow showers after midnight"],
  ["3000470043", "Partly cloudy during the evening, a few snow showers developing later during the night"],
  ["3000570011", "Scattered strong thunderstorms developing this afternoon"],
  ["3000570012", "Partly cloudy early, scattered strong thunderstorms developing this afternoon"],
  ["3000570013", "Partly cloudy with scattered strong thunderstorms developing during the afternoon"],
  ["3000570031", "Scattered strong thunderstorms developing during the afternoon"],
  ["3000570032", "Partly cloudy in the morning, scattered strong thunderstorms developing later in the day"],
  ["3000570033", "Partly cloudy with scattered strong storms developing in the afternoon"],
  ["3010281011", "Partly to mostly cloudy and windy"],
  ["3010300013", "Partly cloudy, windy"],
  ["3010300021", "Partly cloudy skies, gusty winds during the evening"],
  ["3010301011", "A mix of clouds and sun with gusty winds"],
  ["3010301012", "Windy with a mix of clouds and sun"],
  ["3010301013", "Partly cloudy and windy"],
  ["3010301021", "Partly cloudy skies with gusty winds"],
  ["3010301022", "Windy with partly cloudy skies"],
  ["3010301032", "Windy with a few clouds from time to time"],
  ["3010321031", "Mostly sunny skies with gusty winds"],
  ["3200300011", "Sunshine at a few afternoon clouds"],
  ["3200300013", "Sunshine to start than a few afternoon clouds"],
  ["3200300014", "Sunny to Partly Cloudy"],
  ["3200300023", "A few passing clouds otherwise generally clear"],
  ["3200300024", "A few passing clouds"],
  ["3200300031", "Sunny along with a few afternoon clouds"],
  ["3200300032", "Mostly sunny skies"],
  ["3200300033", "Except for a few afternoon clouds, mainly sunny"],
  ["3200300034", "Generally sunny despite a few afternoon clouds"],
  ["3200300041", "Mainly clear skies"],
  ["3200300042", "Mostly clear skies"],
  ["3200300043", "Generally clear skies with a few passing clouds"],
  ["3200320011", "Sunny"],
  ["3200320012", "Abundant Sunshine"],
  ["3200320013", "Plentiful Sunshine"],
  ["3200320022", "Mostly clear"],
  ["3200320024", "Generally clear"],
  ["3200320031", "Sunny skies"],
  ["3200320033", "A mainly sunny sky"],
  ["3200320041", "Clear skies"],
  ["3200320042", "Clear"],
  ["3200320043", "A mostly clear sky"],
  ["3200321011", "Sunny with gusty winds developing this afternoon"],
  ["3200321012", "Sunny skies becoming windy late"],
  ["3200321031", "Sunny skies with gusty winds developing later in the day"],
  ["3200321032", "Sunny, becoming windy late"],
  ["3200340013", "Plenty of sunshine"],
  ["3200340033", "Sunshine"],
  ["3200340034", "Generally sunny"],
  ["3210301013", "Sunny and windy"],
  ["3210301023", "Clear and windy"],
  ["3210320011", "Sunny skies, gusty winds during the morning"],
  ["3210320012", "Sunny, gusty winds diminishing during the afternoon"],
  ["3210320013", "Sunny, windy during the morning"],
  ["3210320031", "Sunny skies, gusty winds in the morning"],
  ["3210320032", "Sunny, gusty winds diminishing in the afternoon"],
  ["3210321011", "Sunny with gusty winds"],
  ["3210321012", "Windy with sunshine"],
  ["3210321021", "Clear with Gusty Wins"],
  ["3210321022", "Wendy with Clear Skies"],
  ["3210321032", "Windy with lots of sunshine"],
  ["3400300011", "Sunshine and a few clouds"],
  ["3400300013", "Mainly sunny to start than a few afternoon clouds"],
  ["3400300031", "Sunny along with a few clouds"],
  ["3400300043", "Clear skies with a few passing clouds"],
  ["3400300044", "Generally fair"],
  ["3400340012", "Lots of sunshine"],
  ["3400370031", "Mostly sunny in the morning with isolated thunderstorms developing later in the day"],
  ["3400370032", "A few isolated thunderstorms developing during the afternoon under partly cloudy skies"],
  ["3400370033", "Morning sunshine will give way to isolated thunderstorms during the afternoon"],
  ["3400370034", "Partly cloudy with isolated thunderstorms developing during the afternoon"],
  ["3700280041", "Isolated thunderstorms in the evening, mostly cloudy skies overnight"],
  ["3700280042", "Isolated thunderstorms during the evening, then mainly cloudy overnight"],
  ["3700300021", "Isolated thunderstorms this evening, skies will become partly cloudy after midnight"],
  ["3700300022", "Isolated thunderstorms then partly cloudy after midnight"],
  ["3700300023", "Isolated thunderstorms in the evening, then skies turning partly cloudy after midnight"],
  ["3700300024", "Widely scattered showers and thunderstorms should diminish as the evening progresses"],
  ["3700300032", "Isolated thunderstorms in the morning then partly cloudy late"],
  ["3700300033", "Isolated thunderstorms in the morning, then skies turning partly cloudy late"],
  ["3700300041", "Isolated thunderstorms during the evening hours. Skies will become partly cloudy overnight"],
  ["3700300042", "Isolated thunderstorms during the evening then partly cloudy overnight"],
  ["3700300043", "Isolated thunderstorms during the evening, then skies turning partly cloudy overnight"],
  ["3700320021", "Isolated thunderstorms during the evening, mainly clear skies after midnight"],
  ["3700320022", "Isolated thunderstorms ending early, becoming clear after midnight"],
  ["3700320041", "Isolated thunderstorms in the evening, clear skies overnight"],
  ["3700320042", "Isolated thunderstorms ending during the evening becoming clear overnight"],
  ["3700370011", "Partly cloudy with isolated thunderstorms possible"],
  ["3700370012", "Partly cloudy with a slight chance of thunderstorms"],
  ["3700380014", "Partly to mostly cloudy with a chance of thunderstorms"],
  ["3700380031", "Scattered thunderstorms, especially in the afternoon"],
  ["3700380032", "Variable clouds with thunderstorms, especially in the afternoon"],
  ["3700380033", "Variable clouds with scattered showers and thunderstorms, mainly in the afternoon"],
  ["3700390041", "Isolated thunderstorms during the evening followed by a chance of showers overnight"],
  ["3710371011", "Partly cloudy and windy with isolated thunderstorms possible"],
  ["3710371012", "Partly cloudy and windy with a slight chance of thunderstorms"],
  ["3800040031", "Scattered thunderstorms in the morning becoming more widespread in the afternoon"],
  ["3800040032", "Scattered thunderstorms in the morning than mainly cloudy during the afternoon with thunderstorms likely"],
  ["3800110013", "Mostly cloudy with showers and a few thunderstorms"],
  ["3800110021", "Scattered thunderstorms this evening followed by occasional showers overnight"],
  ["3800110022", "Scattered thunderstorms early than variable clouds overnight with more showers at times"],
  ["3800110024", "Variable clouds with showers and scattered thunderstorms. Storms more numerous this evening"],
  ["3800110041", "Scattered thunderstorms during the evening followed by occasional showers overnight"],
  ["3800110042", "Scattered thunderstorms in the evening, then variable clouds overnight with more showers at times"],
  ["3800110044", "Variable clouds with showers and scattered thunderstorms. Storms more numerous during the evening"],
  ["3800114011", "Showers and scattered thunderstorms"],
  ["3800300021", "Scatter thunderstorms early, then partly cloudy after midnight"],
  ["3800300022", "Scattered thunderstorms during the evening, partly cloudy skies after midnight"],
  ["3800300023", "Partly to mostly cloudy skies with scattered thunderstorms during the evening"],
  ["3800300031", "Scatter thunderstorms in the morning, then partly cloudy late"],
  ["3800300032", "Scattered thunderstorms in the morning, partly cloudy skies late"],
  ["3800300041", "Scattered thunderstorms during the evening, then partly cloudy overnight"],
  ["3800300042", "Scattered thunderstorms in the evening, partly cloudy skies overnight"],
  ["3800300043", "Partly to mostly cloudy skies with scattered thunderstorms before midnight"],
  ["3800370021", "Scattered thunderstorms, especially during the evening"],
  ["3800370022", "Variable clouds with thunderstorms especially early"],
  ["3800370023", "Partly to mostly cloudy skies with scattered thunderstorms mainly during the evening"],
  ["3800370024", "Thunderstorms, especially during the evening"],
  ["3800370031", "Scattered thunderstorms especially in the morning"],
  ["3800370032", "Variable clouds with thunderstorms, especially in the morning"],
  ["3800370033", "Partly to mostly cloudy skies with scattered thunderstorms mainly in the morning"],
  ["3800370034", "Thunderstorms, especially early in the day"],
  ["3800370041", "Scattered thunderstorms especially in the evening"],
  ["3800380011", "Scattered Thunderstorms"],
  ["3800380012", "Variable clouds with thunderstorms"],
  ["3800380013", "Mixed clouds and sun with scattered thunderstorms"],
  ["3800380014", "Scattered showers and thunderstorms"],
  ["3800380023", "Variably cloudy with scattered thunderstorms"],
  ["3810381011", "Windy with Scattered Thunderstorms"],
  ["3900370031", "Scattered showers in the morning, then a slight chance of thunderstorms in the afternoon"],
  ["3900370032", "Scattered showers in the morning, then variable clouds during the afternoon with isolated thunderstorms"],
  ["3900390011", "Variable clouds with scattered showers"],
  ["3900390012", "Variable clouds with showers"],
  ["3900390013", "Partly to mostly cloudy with scattered showers"],
  ["3900390014", "Partly to mostly cloudy skies with a few showers possible"],
  ["4000400011", "Periods of rain. The rain will be heavy at times"],
  ["4000400012", "A steady rain, the rain will be heavy at times"],
  ["4010400013", "Windy with rain, heavy at times"],
  ["4100130012", "Mostly cloudy with scattered snow flurries and snow showers"],
  ["4100260012", "Cloudy with scattered snow showers, mainly during the morning"],
  ["4100260022", "Cloudy with scattered snow showers mainly during the evening"],
  ["4100280012", "Mostly cloudy with scattered snow showers, mainly during the morning"],
  ["4100280022", "Mostly cloudy with scattered snow showers, mainly during the evening"],
  ["4100280031", "Mostly cloudy, intermittent snow showers ending in the morning"],
  ["4100280041", "Mostly cloudy, intermittent snowshowers ending by midnight"],
  ["4100300012", "On and off snow showers ending, peaks of sunshine later"],
  ["4100300022", "On and off snow showers ending, breaks in the overcast later"],
  ["4100300031", "Scattered snow flurries and snow showers before noon, becoming partly cloudy later"],
  ["4200160011", "Snow. Snow will be heavy at times this morning"],
  ["4200160012", "Periods of snow, snow will be heavy at times, especially this morning"],
  ["4200160021", "Snow. Snow will be heavy at times this evening"],
  ["4200160031", "Snow. Snow will be heavy at times during the morning"],
  ["4200160032", "Periods of snow, snow will be heavy at times, especially during the morning"],
  ["4200160041", "Snow. Snow will be heavy at times in the evening"],
  ["4200160042", "Periods of snow, snow will be heavy at times, especially in the evening"],
  ["4200420011", "Heavy snow"],
  ["4200420012", "Snow, heavy at times"],
  ["4210421011", "Snow will be heavy at times along with gusty winds"],
  ["4210421012", "Periods of snow and gusty winds"],
  ["4500460011", "Cloudy with a few showers"],
  ["4600110011", "Overcast with showers at times"],
  ["4600110012", "Cloudy with occasional showers"],
  ["4600280021", "A few showers this evening with mostly cloudy conditions overnight"],
  ["4600280022", "Showers ending early with partial clearing overnight"],
  ["4600280031", "A few showers early with mostly cloudy conditions later in the day"],
  ["4600280032", "Showers ending in the morning with partial clearing in the afternoon"],
  ["4600280041", "A few showers early with mostly cloudy conditions late"],
  ["4600280042", "Showers ending in the evening with partial clearing overnight"],
  ["4600300021", "A few showers this evening with clearing overnight"],
  ["4600300023", "Showers during the evening followed by partly cloudy skies overnight"],
  ["4600300024", "Evening showers, becoming partly cloudy late"],
  ["4600300031", "A few showers early with ample sunshine later in the day"],
  ["4600300033", "Showers during the morning, followed by partly cloudy skies in the afternoon"],
  ["4600300034", "Morning showers becoming partly cloudy in the afternoon"],
  ["4600300041", "A few showers early with clearing later at night"],
  ["4600300043", "Showers during the evening followed by partly cloudy skies late"],
  ["4600300044", "Evening showers becoming partly cloudy overnight"],
  ["4600340021", "A few showers this evening with mostly clear conditions overnight"],
  ["4600370031", "A few showers early with isolated thunderstorms developing later in the day"],
  ["4600370032", "Showers in the morning with isolated thunderstorms in the afternoon"],
  ["4600370034", "A few showers early followed by isolated thunderstorms later in the day"],
  ["4600380032", "A few showers in the morning with scattered thunderstorms arriving in the afternoon"],
  ["4610460012", "Windy with a few showers possible"],
  ["4700140011", "Mostly cloudy with snow flurries and snow showers becoming more widespread in the afternoon"],
  ["4700140013", "Variable clouds with a few snow showers or flurries expected"],
  ["4700140014", "Snow flurries and snow showers tapering off later"],
  ["4700470011", "Flurries and a few snow showers throughout the day"],
  ["4700470012", "Scattered flurries and snow showers"],
  ["4700470021", "Flurries and a few snow showers throughout the night"],
  ["4900050011", "Cloudy with rain and snow showers"],
  ["4900110011", "Cloudy with rain and snow showers early, changing to all rain and becoming intermittent late"],
  ["4900110033", "Rain and snow showers in the morning. The rain and snow will change to rain showers in the afternoon"],
  ["4900140021", "Rain and snow showers this evening tapering to snow showers overnight"],
  ["4900140041", "Rain and snow showers in the evening tapering to snow showers late"],
  ["4900460011", "Mostly cloudy, rain and snow showers this morning, a few rain showers in the afternoon"],
  ["4900460012", "Rain and snow showers this morning, a shower or two in the afternoon, otherwise mostly cloudy"],
  ["4900490012", "A mixture of rain and snow showers"],
  ["5700300021", "Scattered thunderstorms, some strong during the evening, will give way to partly cloudy skies after midnight"],
  ["5700300022", "Scattered thunderstorms, some strong early, then partly cloudy after midnight"],
  ["5700300023", "Scattered thunderstorms, some strong this evening, then skies turning partly cloudy after midnight"],
  ["5700300041", "Scattered thunderstorms, some strong in the evening, will give way to partly cloudy skies overnight"],
  ["5700300042", "Scatter thunderstorms, some strong during the evening, then partly cloudy overnight"],
  ["5700300043", "Scattered thunderstorms, some strong during the evening, then skies turning partly cloudy overnight"],
  ["5700380012", "Variable clouds with thunderstorms. A few may be severe, especially this morning"],
  ["5700570011", "Scattered Strong Thunderstorms"],
  ["5700570012", "Variable clouds with scattered strong thunderstorms"],
  ["5700570013", "Locally strong thunderstorms possible"],
  ["5700570014", "A chance of some strong thunderstorms"],
];



// ────────────────────────────────────────────────────────────────────────────
//  Keyword-based fuzzy matcher
// ────────────────────────────────────────────────────────────────────────────

/**
 * Weather-specific keywords with weights for matching. Higher weight = more
 * important for distinguishing between clips.
 */
/**
 * Weights use STEMMED forms (after stem() is applied).
 */
const KEYWORD_WEIGHTS: Record<string, number> = {
  // Precipitation type (high weight — must match)
  thunderstorm: 5, snow: 5, rain: 4, shower: 4,
  drizzle: 4, sleet: 4, freezing: 4, flurry: 3, hail: 4,
  wintry: 4, blizzard: 5,
  // Intensity
  heavy: 3, light: 3, strong: 3, severe: 3, steady: 3, occasional: 2,
  intermittent: 2, scattered: 3, isolated: 3, widespread: 2, frequent: 2,
  // Sky conditions (stemmed)
  cloud: 2, sun: 2, clear: 2, partly: 2, mostly: 2,
  fair: 2,
  // Time of day (stemmed)
  morning: 3, afternoon: 3, evening: 3, night: 3,
  late: 2, early: 2, developing: 2, ending: 3, arriving: 2,
  // Wind (stemmed to "wind")
  wind: 3,
  // Transitions
  becoming: 3, followed: 2, turning: 2, clearing: 3, decreasing: 2,
  increasing: 2, tapering: 2, mixing: 2,
  // Qualifiers
  foggy: 3, fog: 3, hazy: 2,
  // Misc
  periods: 2, variable: 2,
};

/** Stop words to exclude from matching. */
const STOP_WORDS = new Set([
  "a", "an", "the", "of", "in", "with", "and", "or", "to", "for",
  "at", "by", "on", "is", "will", "be", "are", "was", "some", "few",
  "this", "that", "then", "but", "from", "give", "way", "more",
  "later", "during", "before", "after", "around", "about", "into",
  "your", "our", "expected", "possible", "likely", "chance", "mainly",
  "generally", "especially", "otherwise", "remaining",
  "low", "high", "near", "new", "could", "may", "can",
  "areas", "area", "also", "through", "between",
]);

/**
 * Normalize weather terms to canonical forms so "windy"/"wind"/"winds",
 * "shower"/"showers", "cloudy"/"clouds"/"cloud" etc. all match.
 */
const STEM_MAP: Record<string, string> = {
  winds: "wind", windy: "wind", breezy: "wind", blustery: "wind", gusty: "wind",
  showers: "shower", shower: "shower",
  clouds: "cloud", cloudy: "cloud", cloudiness: "cloud",
  thunderstorms: "thunderstorm", tstorms: "thunderstorm", thunder: "thunderstorm", storms: "thunderstorm",
  flurries: "flurry", flurry: "flurry",
  snowy: "snow",
  rainy: "rain", rains: "rain",
  sunny: "sun", sunshine: "sun",
  overcast: "cloud",
  overnight: "night", midnight: "night",
  evening: "evening",
  morning: "morning",
  afternoon: "afternoon",
};

function stem(word: string): string {
  return STEM_MAP[word] ?? word;
}

/**
 * Tokenize, normalize, and stem text for matching.
 */
function tokenize(text: string): string[] {
  return text.toLowerCase()
    .replace(/[.,!?;:'"]/g, "")
    .split(/\s+/)
    .filter(w => w.length > 1 && !STOP_WORDS.has(w))
    .map(stem);
}

/**
 * Pre-computed token sets for each longform clip.
 * Built lazily on first use.
 */
let tokenCache: Map<number, string[]> | null = null;

function getTokenCache(): Map<number, string[]> {
  if (tokenCache) return tokenCache;
  tokenCache = new Map();
  for (let i = 0; i < LONGFORM_CLIPS.length; i++) {
    tokenCache.set(i, tokenize(LONGFORM_CLIPS[i][1]));
  }
  return tokenCache;
}

/**
 * Score how well a clip's text matches the target text.
 * Returns a weighted overlap score normalized by the clip's keyword count.
 */
function scoreMatch(targetTokens: string[], clipTokens: string[]): number {
  const clipSet = new Set(clipTokens);
  let matchWeight = 0;
  let totalWeight = 0;

  for (const token of targetTokens) {
    const weight = KEYWORD_WEIGHTS[token] ?? 1;
    totalWeight += weight;
    if (clipSet.has(token)) {
      matchWeight += weight;
    }
  }

  if (totalWeight === 0) return 0;

  // Bidirectional: also penalize if the clip has important words the target doesn't
  const targetSet = new Set(targetTokens);
  let clipOnlyPenalty = 0;
  for (const token of clipTokens) {
    const weight = KEYWORD_WEIGHTS[token] ?? 0;
    if (weight >= 3 && !targetSet.has(token)) {
      clipOnlyPenalty += weight * 0.5;
    }
  }

  return (matchWeight - clipOnlyPenalty) / totalWeight;
}

// ────────────────────────────────────────────────────────────────────────────
//  Public API
// ────────────────────────────────────────────────────────────────────────────

/** Minimum match score to consider a longform clip usable.
 * 0.45 allows partial matches (e.g., "Partly cloudy" matching when
 * NWS text also mentions wind/temp details not in the clip). */
const MIN_MATCH_SCORE = 0.45;

// ────────────────────────────────────────────────────────────────────────────
//  AJ composite token cache
// ────────────────────────────────────────────────────────────────────────────

let ajCompositeTokenCache: Map<number, string[]> | null = null;

function getAjCompositeTokenCache(): Map<number, string[]> {
  if (ajCompositeTokenCache) return ajCompositeTokenCache;
  ajCompositeTokenCache = new Map();
  for (let i = 0; i < AJ_COMPOSITE_CLIPS.length; i++) {
    ajCompositeTokenCache.set(i, tokenize(AJ_COMPOSITE_CLIPS[i][1]));
  }
  return ajCompositeTokenCache;
}

// ────────────────────────────────────────────────────────────────────────────
//  JC exclusive token cache
// ────────────────────────────────────────────────────────────────────────────

let jcExclusiveTokenCache: Map<number, string[]> | null = null;

function getJcExclusiveTokenCache(): Map<number, string[]> {
  if (jcExclusiveTokenCache) return jcExclusiveTokenCache;
  jcExclusiveTokenCache = new Map();
  for (let i = 0; i < JC_EXCLUSIVE_CLIPS.length; i++) {
    jcExclusiveTokenCache.set(i, tokenize(JC_EXCLUSIVE_CLIPS[i][1]));
  }
  return jcExclusiveTokenCache;
}

/**
 * Find the best-matching longform clip for an NWS detailed forecast text.
 *
 * Returns the clip with the highest keyword overlap score, or null if
 * no clip scores above the minimum threshold.
 *
 * Works for both AJ (N-series) and JC (H-series) — the H-series uses the
 * same number codes as N-series (same phrases, different voice). JC has
 * 418 clips that share numbers with AJ, plus 364 unique H08xxxx clips
 * that aren't transcribed yet.
 *
 * The match is based on weather keywords (precipitation type, sky conditions,
 * time of day, wind, transitions) weighted by importance.
 */
export function findLongformMatch(detailedForecast: string, narratorId: NarratorId): ClipResolution | null {
  if (narratorId !== "allan-jackson" && narratorId !== "jim-cantore") return null;
  if (!detailedForecast) return null;

  // Strip temperature numbers, wind speed numbers, and compass directions
  // that aren't present in the longform clip text. Keep weather keywords.
  const cleaned = detailedForecast
    .replace(/\b\d+\s*(?:degrees?|°F?|mph|percent|%)\b/gi, "")
    .replace(/\b(?:low|high)\s+(?:around|near|of)\s+\d+/gi, "")
    .replace(/\b(?:around|near|about)\s+\d+/gi, "")
    .replace(/\b(?:north|south|east|west|northwest|northeast|southwest|southeast|nw|ne|sw|se|nnw|nne|ssw|sse|wnw|wsw|ene|ese)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  const targetTokens = tokenize(cleaned);
  if (targetTokens.length < 2) return null;

  const cache = getTokenCache();
  let bestIdx = -1;
  let bestScore = MIN_MATCH_SCORE;

  for (let i = 0; i < LONGFORM_CLIPS.length; i++) {
    const clipTokens = cache.get(i)!;
    const score = scoreMatch(targetTokens, clipTokens);
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }

  // For JC, also score against the 364 exclusive H08xxxx clips and take the
  // best match from either pool (shared N-series or JC-exclusive).
  if (narratorId === "jim-cantore") {
    const jcCache = getJcExclusiveTokenCache();
    let bestJcIdx = -1;
    let bestJcScore = MIN_MATCH_SCORE;
    for (let i = 0; i < JC_EXCLUSIVE_CLIPS.length; i++) {
      const clipTokens = jcCache.get(i)!;
      const score = scoreMatch(targetTokens, clipTokens);
      if (score > bestJcScore) {
        bestJcScore = score;
        bestJcIdx = i;
      }
    }

    // JC-exclusive beat the shared pool — use it
    if (bestJcIdx >= 0 && bestJcScore > bestScore) {
      const [jcFilename, jcText] = JC_EXCLUSIVE_CLIPS[bestJcIdx];
      return {
        src: `${JC_LF_DIR}/${jcFilename}.mp3`,
        text: jcText,
        confidence: "likely",
      };
    }

    // Fall back to shared pool (N→H mapping). DUMMY clips are AJ-only.
    if (bestIdx < 0) return null;
    const [filename, text] = LONGFORM_CLIPS[bestIdx];
    if (!filename.startsWith("N")) return null;
    const jcFilename = filename.replace(/^N/, "H");
    return {
      src: `${JC_LF_DIR}/${jcFilename}.mp3`,
      text,
      confidence: "likely",
    };
  }

  // For AJ, also score against the 549 composite phrases (deduped from 1,525
  // two-period pair clips) and take the best match from either pool.
  const compCache = getAjCompositeTokenCache();
  let bestCompIdx = -1;
  let bestCompScore = MIN_MATCH_SCORE;
  for (let i = 0; i < AJ_COMPOSITE_CLIPS.length; i++) {
    const clipTokens = compCache.get(i)!;
    const score = scoreMatch(targetTokens, clipTokens);
    if (score > bestCompScore) {
      bestCompScore = score;
      bestCompIdx = i;
    }
  }

  if (bestCompIdx >= 0 && bestCompScore > bestScore) {
    const [compFilename, compText] = AJ_COMPOSITE_CLIPS[bestCompIdx];
    return {
      src: `${LF_DIR}/${compFilename}.mp3`,
      text: compText,
      confidence: "likely",
    };
  }

  if (bestIdx < 0) return null;

  const [filename, text] = LONGFORM_CLIPS[bestIdx];
  return {
    src: `${LF_DIR}/${filename}.mp3`,
    text,
    confidence: "likely",
  };
}

/**
 * Get a longform clip by its exact filename (without extension).
 */
export function getLongformClip(filename: string): ClipResolution | null {
  const entry = LONGFORM_CLIPS.find(([f]) => f === filename);
  if (!entry) return null;
  return {
    src: `${LF_DIR}/${entry[0]}.mp3`,
    text: entry[1],
    confidence: "likely",
  };
}

/**
 * Total number of longform clips available.
 */
export const LONGFORM_COUNT = LONGFORM_CLIPS.length;
