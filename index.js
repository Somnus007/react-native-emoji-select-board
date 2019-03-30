import React from 'react';
import {
  Text,
  View,
  TouchableOpacity,
  Animated,
  Dimensions,
  Image,
  TouchableHighlight,
  AsyncStorage,
  Platform
} from 'react-native';
import emojiData from 'emoji-datasource';
import _ from 'lodash';
import ScrollableTabView from 'react-native-scrollable-tab-view';
import PropTypes from 'prop-types';
import styles from './style';
import TabBar from './tab';
import TabBarDot from './tabDot';
import stringify from './stringify';
import parse from './parse';
import splitter from './grapheme-splitter';
import WebViewPage from './webView';
import ViewPropTypes from './viewproptypes';

const { height, width } = Dimensions.get('window');
require('string.fromcodepoint');

const categories = ['People', 'Nature', 'Foods', 'Activity', 'Places', 'Objects', 'Symbols', 'Flags'];
const blockIconNum = 23;
let choiceness = ['grinning', 'grin', 'joy', 'sweat_smile', 'laughing', 'wink', 'blush', 'yum', 'heart_eyes', 'kissing_heart',
  'kissing_smiling_eyes', 'stuck_out_tongue_winking_eye', 'sunglasses', 'smirk', 'unamused', 'thinking_face',
  'flushed', 'rage', 'triumph', 'sob', 'mask', 'sleeping', 'zzz', 'hankey', 'ghost', '+1', '-1', 'facepunch', 'v',
  'ok_hank', 'muscle', 'pray', 'point_up', 'lips', 'womans_hat', 'purse', 'crown', 'dog', 'panda_face', 'pig',
  'earth_asia', 'cherry_blossom', 'sunny', 'thunder_cloud_and_rain', 'zap', 'snowflake', 'birthday', 'lollipop',
  'beers', 'popcorn', 'soccer', 'airplane', 'iphone', 'tada', 'heart', 'broken_heart', 'flag_us', 'flag_cn'];

const choicenessAndroid = ['grinning', 'grin', 'joy', 'sweat_smile', 'laughing', 'wink', 'blush', 'yum', 'heart_eyes', 'kissing_heart',
  'kissing_smiling_eyes', 'stuck_out_tongue_winking_eye', 'sunglasses', 'smirk', 'unamused',
  'flushed', 'rage', 'triumph', 'sob', 'mask', 'sleeping', 'zzz', 'hankey', 'ghost', '+1', '-1', 'facepunch', 'v',
  'ok_hank', 'muscle', 'pray', 'point_up', 'lips', 'womans_hat', 'purse', 'crown', 'dog', 'panda_face', 'pig',
  'earth_asia', 'cherry_blossom', 'sunny', 'thunder_cloud_and_rain', 'zap', 'snowflake', 'birthday', 'lollipop',
  'beers', 'soccer', 'airplane', 'iphone', 'tada', 'heart', 'broken_heart', 'flag_us', 'flag_cn'];

const HISTORY_STORAGE = 'history_storage';
class EmojiBoard extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      data: [],
      groupIndex: 0,
      showWV: false,
      position: new Animated.Value(this.props.show ? 0 : -300),
      wvPosition: new Animated.Value(-height),
      history: [],
      currentMainTab: 0,
      currentDotTab: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    };
    if (Platform.OS === 'android') {
      choiceness = choicenessAndroid;
    }
  }

    static defaultProps = {
      show: false,
      concise: true,
      showHistoryBar: true,
      showPlusBar: false,
      asyncRender: false,
    };

    componentDidMount() {
      AsyncStorage.getItem(HISTORY_STORAGE, (err, result) => {
        if (result) {
          this.setState({
            history: JSON.parse(result)
          }, () => {
            console.log(this.state.history);
          });
        }
      });
    }

    componentWillMount() {
      this.setState((prevState, props) => {
        const { showHistoryBar, showPlusBar } = props;
        if (!showHistoryBar && !showPlusBar) {
          return {};
        }
        let { groupIndex, currentMainTab } = prevState;
        if (showHistoryBar) {
          groupIndex += 1;
          currentMainTab += 1;
        }
        if (showPlusBar) {
          groupIndex += 1;
          currentMainTab += 1;
        }
        return {
          groupIndex,
          currentMainTab
        };
      });
      this._classify();
    }

    componentDidUpdate(prevProps) {
      const { position, wvPosition, showWV } = this.state;
      Animated.timing(
        position,
        {
          duration: 300,
          toValue: this.props.show ? 0 : -300
        }
      ).start();
      Animated.timing(
        wvPosition,
        {
          duration: 300,
          toValue: showWV ? 0 : -height
        }
      ).start();
      const prevBlackList = prevProps.blackList;
      const { blackList } = this.props;
      if (JSON.stringify(prevBlackList) !== JSON.stringify(blackList)) {
        this._classify();
      }
    }

    _charFromCode = (utf16) => {
      return String.fromCodePoint(...utf16.split('-').map(u => `0x${u}`));
    }

    _classify = () => {
      // remove emoji in black list
      let blackList = ['white_frowning_face'];
      if (this.props.blackList && Array.isArray(this.props.blackList)) {
        blackList = blackList.concat(this.props.blackList);
      }
      let filteredData = emojiData.filter(e => !_.includes(blackList, e.short_name));
      // sort by order number
      const sortedData = _.orderBy(filteredData, 'sort_order');
      // sort by category
      const groupedData = _.groupBy(sortedData, 'category');
      // create data for concise mode
      if (this.props.concise) {
        filteredData = emojiData.filter(e => _.includes(choiceness, e.short_name));
        const temp = [];
        _.mapKeys(filteredData, (value) => {
          temp.push({
            code: this._charFromCode(value.unified),
            name: value.short_name
          });
        });
        _.each(choiceness, (value) => {
          const one = temp.filter(e => _.includes([value], e.name));
          if (one[0]) {
            this.setState((prevState) => {
              const arr = prevState.data;
              arr.push(one[0]);
              return {
                data: arr
              };
            });
          }
        });
      } else { // create data for normal mode
        const allEmojis = _.mapValues(groupedData, group => group.map((value) => {
          return {
            code: this._charFromCode(value.unified),
            name: value.short_name
          };
        }));
        this.setState({
          data: allEmojis,
        }, () => {
          console.log(this.state.data);
        });
      }
    }

    _onChangeTabMain = (data) => {
      this.setState({ currentMainTab: data.i });
    }

    _onChangeTabDot = (data) => {
      this.setState((prevState) => {
        const dotTab = prevState.currentDotTab;
        dotTab[prevState.currentMainTab] = data.i;
        return {
          currentDotTab: dotTab
        };
      });
    }

    _onPlusPress = () => {
      this.setState({ showWV: true });
    }

    _onEmojiIconPress = (val) => {
      if (this.props.onEmojiIconPress) {
        this.props.onEmojiIconPress(val);
        this._history(val);
      }
    }

    _onBackspacePress = () => {
      if (this.props.onBackspacePress) { this.props.onBackspacePress(); }
    }

    _onCloseWV = () => {
      this.setState({ showWV: false });
    }

    _history = (val) => {
      //AsyncStorage.removeItem(HISTORY_STORAGE);
      AsyncStorage.getItem(HISTORY_STORAGE, (err, history) => {
        const value = _.clone(val);
        let result = [];
        if (history) {
          result = JSON.parse(history);
          const valIndex = _.find(result, value);
          if (valIndex) {
            valIndex.freq++;
            _.remove(result, { name: valIndex.name });
            result.push(valIndex);
          } else {
            value.freq = 1;
            result.push(value);
          }
        } else {
          value.freq = 1;
          result.push(value);
        }
        result = _.reverse(_.sortBy(result, [o => o.freq]));
        AsyncStorage.setItem(HISTORY_STORAGE, JSON.stringify(result));
        this.setState({ history: result });
      });
    }

    _renderGroup = (emoji) => {
      const { asyncRender, showPlusBar } = this.props;
      const { currentDotTab, currentMainTab } = this.state;
      let groupIndex = showPlusBar ? 1 : 0;
      if (asyncRender && currentMainTab !== groupIndex) {
        groupIndex++;
        return [];
      }
      groupIndex++;
      const groupView = [];
      if (!emoji) { return groupView; }
      const blocks = Math.ceil(emoji.length / blockIconNum);
      for (let i = 0; i < blocks; i++) {
        const ge = _.slice(emoji, i * blockIconNum, (i + 1) * blockIconNum);
        groupView.push(
          <View
            style={styles.groupView}
            key={`${emoji[0].name}block${i}`}
            tabLabel={`${emoji[0].name}block${i}`}
        >
            {
                ge.map((value) => {
                  if ((asyncRender && currentDotTab[currentMainTab] === i) || !asyncRender) {
                    return (
                      <TouchableHighlight
                        underlayColor="#f1f1f1"
                        onPress={() => this._onEmojiIconPress(value)}
                        style={styles.emojiTouch}
                        key={value.name}
                        >
                        <Text
                          style={styles.emoji}
                                    >
                          {value.code}
                        </Text>
                      </TouchableHighlight>
                    );
                  }
                  return null;
                })
            }
            {
                (asyncRender && currentDotTab[currentMainTab] === i) || !asyncRender ?
                  (
                    <TouchableOpacity
                      onPress={() => this._onBackspacePress()}
                      style={[styles.emojiTouch, styles.delete]}
                    >
                      <Image
                        resizeMode="contain"
                        style={styles.backspace}
                        source={require('./backspace.png')} />
                    </TouchableOpacity>
                  ) : null
            }
          </View>
        );
      }
      return groupView;
    };

    render() {
      const {
        history, data, showWV, position, groupIndex, wvPosition
      } = this.state;
      const {
        showHistoryBar, showPlusBar, concise, style
      } = this.props;
      const groupsView = [];
      const plusButton = (
        <View
          tabLabel="plus"
          style={styles.cateView}
          key="0_plus"
        />
      );
      const histroyView = this._renderGroup(history);
      const historyPage = (
        <View
          tabLabel="history"
          style={styles.cateView}
          key="0_history"
        >
          <ScrollableTabView
            tabBarPosition="bottom"
            renderTabBar={() => <TabBarDot {...this.props} />}
            onChangeTab={this._onChangeTabDot}
            initialPage={0}
            tabBarActiveTextColor="#fc7d30"
            style={styles.scrollGroupTable}
            tabBarUnderlineStyle={{ backgroundColor: '#fc7d30', height: 2 }}
            prerenderingSiblingsNumber={3}
          >
            {
                histroyView
            }
          </ScrollableTabView>
        </View>
      );
      if (showPlusBar) {
        groupsView.push(plusButton);
      }

      if (showHistoryBar) {
        groupsView.push(historyPage);
      }

      if (concise) {
        const conciseView = this._renderGroup(data);
        groupsView.push(
          <View
            tabLabel={data[0].code}
            style={styles.cateView}
            key={data[0].name}
          >
            <ScrollableTabView
              tabBarPosition="bottom"
              renderTabBar={() => <TabBarDot {...this.props} />}
              onChangeTab={this._onChangeTabDot}
              initialPage={0}
              tabBarActiveTextColor="#fc7d30"
              style={styles.scrollGroupTable}
              tabBarUnderlineStyle={{ backgroundColor: '#fc7d30', height: 2 }}
              prerenderingSiblingsNumber={3}
            >
              {
                conciseView
              }
            </ScrollableTabView>
          </View>
        );
      } else {
        _.each(categories, (value) => {
          const categoryView = this._renderGroup(data[value]);
          if (categoryView.length >= 0) {
            groupsView.push(
              <View
                tabLabel={data[value][0].code}
                style={styles.cateView}
                key={value}
              >
                <ScrollableTabView
                  tabBarPosition="bottom"
                  renderTabBar={() => <TabBarDot {...this.props} />}
                  onChangeTab={this._onChangeTabDot}
                  initialPage={0}
                  tabBarActiveTextColor="#fc7d30"
                  style={styles.scrollGroupTable}
                  tabBarUnderlineStyle={{ backgroundColor: '#fc7d30', height: 2 }}
                  prerenderingSiblingsNumber={3}
                >
                  {
                    categoryView
                  }
                </ScrollableTabView>
              </View>
            );
          }
        });
      }

      return (

        (!showWV) ?
          <Animated.View style={[styles.container, { bottom: position }, style]}>
            <ScrollableTabView
              tabBarPosition="overlayBottom"
              renderTabBar={() => <TabBar {...this.props} onPlusPress={this._onPlusPress} />}
              initialPage={groupIndex}
              onChangeTab={this._onChangeTabMain}
              tabBarActiveTextColor="#fc7d30"
              style={styles.scrollTable}
              tabBarUnderlineStyle={{ backgroundColor: '#fc7d30', height: 2 }}
              prerenderingSiblingsNumber={3}
            >
              {groupsView}
            </ScrollableTabView>
          </Animated.View> :
          <Animated.View style={[styles.wvContainer, { bottom: wvPosition }]}>
            <WebViewPage onBackPress={this._onCloseWV} />
          </Animated.View>
      );
    }
}

EmojiBoard.propTypes = {
  onEmojiIconPress: PropTypes.func,
  onBackspacePress: PropTypes.func,
  style: ViewPropTypes.style,
  show: PropTypes.bool,
  concise: PropTypes.bool,
  showHistoryBar: PropTypes.bool,
  showPlusBar: PropTypes.bool,
  asyncRender: PropTypes.bool,
  blackList: PropTypes.arrayOf(PropTypes.string)
};


export default EmojiBoard;
export {
  stringify,
  parse,
  splitter
};
