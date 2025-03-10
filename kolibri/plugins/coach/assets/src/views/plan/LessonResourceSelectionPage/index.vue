<template>

  <CoreBase
    :immersivePage="getUserPermissions.can_manage_content"
    immersivePageIcon="close"
    :immersivePagePrimary="false"
    :immersivePageRoute="exitButtonRoute"
    :appBarTitle="$tr('manageResourcesAction')"
    :authorized="userIsAuthorized"
    authorizedRole="adminOrCoach"
    :pageTitle="pageTitle"
  >

    <KPageContainer>
      <h1 v-if="showChannels">
        {{ $tr('documentTitle', { lessonName: currentLesson.title }) }}
      </h1>
      <div v-if="!showChannels">
        <ContentCardList
          :contentList="bookmarksContentList"
          :showSelectAll="selectAllIsVisible"
          :selectAllChecked="addableContent.length === 0"
          :contentCardLink="bookmarkLink"
          :contentIsChecked="contentIsInLesson"
          :contentHasCheckbox="c => !contentIsDirectoryKind(c)"
          :viewMoreButtonState="viewMoreButtonState"
          :contentCardMessage="selectionMetadata"
          @changeselectall="toggleTopicInWorkingResources"
          @change_content_card="toggleSelected"
          @moreresults="handleMoreResults"
        />
      </div>
      <div v-else>
        <div @click="lessonCardClicked">
          <KRouterLink
            v-if="bookmarksCount"
            :appearanceOverrides="{
              width: '100%',
              textDecoration: 'none',
              color: $themeTokens.text }"
            :to="getBookmarksLink()"
          >
            <div :class="windowIsSmall ? 'mobile-bookmark-container' : 'bookmark-container'">
              <BookmarkIcon :class="windowIsSmall ? 'mobile-bookmark-icon' : ''" />
              <div :class="windowIsSmall ? 'mobile-text' : 'text'">
                <h3>{{ coreString('bookmarksLabel') }}</h3>
                <p>{{ $tr('resources', { count: bookmarksCount }) }}</p>
              </div>
            </div>
          </KRouterLink>
        </div>
        <KGrid>
          <KGridItem :layout12="{ span: 6 }">
            <LessonsSearchBox @searchterm="handleSearchTerm" />
          </KGridItem>

          <KGridItem :layout12="{ span: 6, alignment: 'right' }">
            <p>
              {{ $tr('totalResourcesSelected', { total: workingResources.length }) }}
            </p>
          </KGridItem>
        </KGrid>

        <LessonsSearchFilters
          v-if="inSearchMode"
          v-model="filters"
          class="search-filters"
          :searchTerm="searchTerm"
          :searchResults="searchResults"
        />

        <ResourceSelectionBreadcrumbs
          v-if="!inSearchMode"
          :ancestors="ancestors"
          :channelsLink="channelsLink"
          :topicsLink="topicsLink"
        />

        <h2>{{ topicTitle }}</h2>
        <p>{{ topicDescription }}</p>

        <ContentCardList
          v-if="!isExiting"
          :contentList="filteredContentList"
          :showSelectAll="selectAllIsVisible"
          :viewMoreButtonState="viewMoreButtonState"
          :selectAllChecked="addableContent.length === 0"
          :contentIsChecked="contentIsInLesson"
          :contentHasCheckbox="c => !contentIsDirectoryKind(c)"
          :contentCardMessage="selectionMetadata"
          :contentCardLink="contentLink"
          @changeselectall="toggleTopicInWorkingResources"
          @change_content_card="toggleSelected"
          @moreresults="handleMoreResults"
        />
      </div>
    </KPageContainer>

    <BottomAppBar>
      <KRouterLink
        :text="inSearchMode ? $tr('exitSearchButtonLabel') : coreString('closeAction')"
        :primary="true"
        appearance="raised-button"
        :to="exitButtonRoute"
      />
    </BottomAppBar>

  </CoreBase>

</template>


<script>

  import { mapState, mapActions, mapGetters, mapMutations } from 'vuex';
  import samePageCheckGenerator from 'kolibri.utils.samePageCheckGenerator';
  import debounce from 'lodash/debounce';
  import every from 'lodash/every';
  import pickBy from 'lodash/pickBy';
  import BottomAppBar from 'kolibri.coreVue.components.BottomAppBar';
  import commonCoreStrings from 'kolibri.coreVue.mixins.commonCoreStrings';
  import responsiveWindowMixin from 'kolibri.coreVue.mixins.responsiveWindowMixin';
  import commonCoach from '../../common';
  import { LessonsPageNames } from '../../../constants/lessonsConstants';
  import { BookmarksResource } from '../../../../../../../../kolibri/core/assets/src/api-resources/index.js';
  import LessonsSearchBox from './SearchTools/LessonsSearchBox';
  import LessonsSearchFilters from './SearchTools/LessonsSearchFilters';
  import ResourceSelectionBreadcrumbs from './SearchTools/ResourceSelectionBreadcrumbs';
  import ContentCardList from './ContentCardList';
  import BookmarkIcon from './LessonContentCard/BookmarkIcon';

  export default {
    // this is inaccurately named because it applies to exams also
    name: 'LessonResourceSelectionPage',
    metaInfo() {
      return {
        title: this.$tr('documentTitle', { lessonName: this.currentLesson.title }),
      };
    },
    components: {
      ContentCardList,
      LessonsSearchFilters,
      LessonsSearchBox,
      ResourceSelectionBreadcrumbs,
      BottomAppBar,
      BookmarkIcon,
    },
    mixins: [commonCoach, commonCoreStrings, responsiveWindowMixin],
    data() {
      return {
        // null corresponds to 'All' filter value
        filters: {
          channel: this.$route.query.channel || null,
          kind: this.$route.query.kind || null,
          role: this.$route.query.role || null,
        },
        isExiting: false,
        moreResultsState: null,
        resourcesChanged: false,
        bookmarksCount: 0,
        showChannels: true,
      };
    },
    computed: {
      ...mapState(['pageName']),
      ...mapState('classSummary', { classId: 'id' }),
      ...mapState('lessonSummary', ['currentLesson', 'workingResources']),
      ...mapState('lessonSummary/resources', [
        'ancestorCounts',
        'contentList',
        'bookmarksList',
        'searchResults',
        'ancestors',
      ]),
      ...mapGetters('lessonSummary/resources', ['numRemainingSearchResults']),
      ...mapGetters(['getUserPermissions']),
      toolbarRoute() {
        if (this.$route.query.last) {
          return this.$router.getRoute(this.$route.query.last);
        }
        return this.$store.state.toolbarRoute;
      },
      pageTitle() {
        return this.$tr('documentTitle', { lessonName: this.currentLesson.title });
      },
      bookmarksContentList() {
        return this.bookmarksList ? this.bookmarksList : [];
      },
      filteredContentList() {
        const { role } = this.filters;
        if (!this.inSearchMode) {
          return this.contentList;
        }
        const list = this.contentList ? this.contentList : this.bookmarksList;
        return list.filter(contentNode => {
          let passesFilters = true;
          if (role === 'nonCoach') {
            passesFilters = passesFilters && contentNode.num_coach_contents === 0;
          }
          if (role === 'coach') {
            passesFilters = passesFilters && contentNode.num_coach_contents > 0;
          }
          return passesFilters;
        });
      },
      lessonId() {
        return this.currentLesson.id;
      },
      inSearchMode() {
        return this.pageName === LessonsPageNames.SELECTION_SEARCH;
      },
      searchTerm() {
        return this.$route.params.searchTerm || '';
      },
      routerParams() {
        return {
          classId: this.classId,
          lessonId: this.lessonId ? this.lessonId : this.$route.params.lessonId,
        };
      },
      debouncedSaveResources() {
        return debounce(this.saveResources, 1000);
      },
      selectAllIsVisible() {
        // Do not show 'Select All' if on Search Results, on Channels Page,
        // or if all contents are topics
        return (
          !this.inSearchMode &&
          this.pageName !== LessonsPageNames.SELECTION_ROOT &&
          !every(this.contentList, this.contentIsDirectoryKind)
        );
      },
      viewMoreButtonState() {
        if (this.moreResultsState === 'waiting' || this.moreResultsState === 'error') {
          return this.moreResultsState;
        }
        if (!this.inSearchMode || this.numRemainingSearchResults === 0) {
          return 'no_more_results';
        }
        return 'visible';
      },
      contentIsInLesson() {
        return ({ id }) =>
          Boolean(this.workingResources.find(resource => resource.contentnode_id === id));
      },
      addableContent() {
        // Content in the topic that can be added if 'Select All' is clicked
        const list = this.contentList ? this.contentList : this.bookmarksList;
        return list.filter(
          content => !this.contentIsDirectoryKind(content) && !this.contentIsInLesson(content)
        );
      },
      channelsLink() {
        return this.selectionRootLink();
      },
      topicTitle() {
        if (!this.ancestors.length) {
          return '';
        }
        return this.ancestors[this.ancestors.length - 1].title;
      },
      topicDescription() {
        if (!this.ancestors.length) {
          return '';
        }
        return this.ancestors[this.ancestors.length - 1].description;
      },
      exitButtonRoute() {
        const lastId = this.$route.query.last_id;
        if (this.inSearchMode && lastId) {
          const queryCopy = { ...this.$route.query };
          delete queryCopy.last_id;
          return this.$router.getRoute(LessonsPageNames.SELECTION, { topicId: lastId }, queryCopy);
        } else if (this.inSearchMode) {
          return this.selectionRootLink({ ...this.routerParams });
        } else if (this.$route.query.last === 'ReportsLessonReportPage') {
          // HACK to fix #7583 and #7584
          return {
            name: 'ReportsLessonReportPage',
          };
        } else if (this.$route.query.last === 'ReportsLessonLearnerListPage') {
          // HACK to fix similar bug in Learner version of the report page
          return {
            name: 'ReportsLessonLearnerListPage',
          };
        } else {
          return this.toolbarRoute;
        }
      },
    },
    watch: {
      workingResources(newVal, oldVal) {
        this.showResourcesDifferenceMessage(newVal.length - oldVal.length);
        this.debouncedSaveResources();
      },
      filters(newVal) {
        const newQuery = {
          ...this.$route.query,
          ...newVal,
        };
        this.$router.push({
          query: pickBy(newQuery),
        });
      },
    },
    beforeRouteLeave(to, from, next) {
      // Block the UI and show a notification in case last save takes too long
      this.isExiting = true;

      // If the working resources array hasn't changed at least once,
      // just exit without autosaving
      if (!this.resourcesChanged) {
        next();
        this.isExiting = false;
      } else {
        this.resourcesChanged = true;
        const isSamePage = samePageCheckGenerator(this.$store);
        setTimeout(() => {
          if (isSamePage()) {
            this.createSnackbar(this.$tr('saveBeforeExitSnackbarText'));
          }
        }, 500);

        // Cancel any debounced calls
        this.debouncedSaveResources.cancel();
        this.saveLessonResources({
          lessonId: this.lessonId,
          resources: [...this.workingResources],
        })
          .then(() => {
            this.clearSnackbar();
            this.isExiting = false;
            next();
          })
          .catch(() => {
            this.showResourcesChangedError();
            this.isExiting = false;
            next(false);
          });
      }
    },
    created() {
      this.getBookmarks().then(count => {
        this.bookmarksCount = count;
      });
    },
    methods: {
      ...mapActions(['createSnackbar', 'clearSnackbar']),
      ...mapActions('lessonSummary', ['saveLessonResources', 'addToResourceCache']),
      ...mapActions('lessonSummary/resources', ['fetchAdditionalSearchResults']),
      ...mapMutations('lessonSummary', {
        addToWorkingResources: 'ADD_TO_WORKING_RESOURCES',
        removeFromSelectedResources: 'REMOVE_FROM_WORKING_RESOURCES',
      }),
      getBookmarks() {
        return BookmarksResource.fetchCollection().then(bookmarks => {
          return bookmarks.length;
        });
      },
      getBookmarksLink() {
        return {
          name: LessonsPageNames.LESSON_SELECTION_BOOKMARKS_MAIN,
        };
      },
      lessonCardClicked() {
        this.showChannels = false;
      },
      showResourcesDifferenceMessage(difference) {
        if (difference === 0) {
          return;
        }
        this.resourcesChanged = true;
        if (difference > 0) {
          this.showSnackbarNotification('resourcesAddedWithCount', { count: difference });
        } else {
          this.showSnackbarNotification('resourcesRemovedWithCount', { count: -difference });
        }
      },
      showResourcesChangedError() {
        this.createSnackbar(this.coachString('saveLessonError'));
      },
      toggleTopicInWorkingResources(isChecked) {
        if (isChecked) {
          this.addableContent.forEach(resource => {
            this.addToResourceCache({
              node: { ...resource },
            });
          });
          this.addToWorkingResources(this.addableContent);
        } else {
          this.removeFromSelectedResources(this.contentList);
        }
      },
      addToSelectedResources(content) {
        const list =
          this.contentList && this.contentList.length ? this.contentList : this.bookmarksList;
        this.addToResourceCache({
          node: list.find(n => n.id === content.id),
        });
        this.addToWorkingResources([content]);
      },
      contentIsDirectoryKind({ is_leaf }) {
        return !is_leaf;
      },
      selectionRootLink() {
        return this.$router.getRoute(LessonsPageNames.SELECTION_ROOT, {}, this.$route.query);
      },
      topicListingLink({ topicId }) {
        return this.$router.getRoute(LessonsPageNames.SELECTION, { topicId }, this.$route.query);
      },
      bookmarkListingLink({ topicId }) {
        return this.$router.getRoute(
          LessonsPageNames.LESSON_SELECTION_BOOKMARKS,
          { topicId },
          this.$route.query
        );
      },
      bookmarkLink(content) {
        if (this.contentIsDirectoryKind(content)) {
          return this.bookmarkListingLink({ ...this.routerParams, topicId: content.id });
        }
        const { query } = this.$route;
        return {
          name: LessonsPageNames.SELECTION_CONTENT_PREVIEW,
          params: {
            ...this.routerParams,
            contentId: content.id,
          },
          query: {
            ...query,
            ...pickBy({
              searchTerm: this.$route.params.searchTerm,
            }),
          },
        };
      },
      contentLink(content) {
        if (this.contentIsDirectoryKind(content)) {
          return this.topicListingLink({ ...this.routerParams, topicId: content.id });
        }
        const { query } = this.$route;
        return {
          name: LessonsPageNames.SELECTION_CONTENT_PREVIEW,
          params: {
            ...this.routerParams,
            contentId: content.id,
          },
          query: {
            ...query,
            ...pickBy({
              searchTerm: this.$route.params.searchTerm,
            }),
          },
        };
      },
      saveResources() {
        return this.saveLessonResources({
          lessonId: this.lessonId,
          resources: this.workingResources,
        });
      },
      selectionMetadata(content) {
        let count = 0;
        let total = 0;
        if (this.ancestorCounts[content.id]) {
          count = this.ancestorCounts[content.id].count;
          total = this.ancestorCounts[content.id].total;
        }
        if (count) {
          return this.$tr('selectionInformation', {
            count,
            total,
          });
        }
        return '';
      },
      toggleSelected({ content, checked }) {
        if (checked) {
          this.addToSelectedResources(content);
        } else {
          this.removeFromSelectedResources([content]);
        }
      },
      handleSearchTerm(searchTerm) {
        const query = {
          last_id: this.$route.query.last_id || this.$route.params.topicId,
        };
        const lastPage = this.$route.query.last;
        if (lastPage) {
          query.last = lastPage;
        }
        this.$router.push({
          name: LessonsPageNames.SELECTION_SEARCH,
          params: {
            searchTerm,
          },
          query,
        });
      },
      handleMoreResults() {
        this.moreResultsState = 'waiting';
        this.fetchAdditionalSearchResults({
          searchTerm: this.searchTerm,
          kind: this.filters.kind,
          channelId: this.filters.channel,
          currentResults: this.searchResults.results,
        })
          .then(() => {
            this.moreResultsState = null;
          })
          .catch(() => {
            this.moreResultsState = 'error';
          });
      },
      topicsLink(topicId) {
        return this.topicListingLink({ ...this.$route.params, topicId });
      },
    },
    $trs: {
      resources: {
        message: '{count} {count, plural, one {resource} other {resources}}',
        context: "Only translate 'resource' and 'resources'.",
      },
      selectionInformation: {
        message:
          '{count, number, integer} of {total, number, integer} {total, plural, one {resource selected} other {resources selected}}',

        context:
          "Indicates the amount of resources selected for a lesson in the 'Manage lesson resources' section.\n\nFor example: '7 of 10 resources selected'.",
      },
      totalResourcesSelected: {
        message:
          '{total, number, integer} {total, plural, one {resource} other {resources}} in this lesson',
        context:
          "Indicates the amount of resources for a lesson in the 'Manage lesson resources' section. For example:\n\n'8 resources in this lesson'",
      },
      documentTitle: {
        message: `Manage resources in '{lessonName}'`,
        context:
          "Title of window that displays when the user clicks on the 'manage resources' button within an individual lesson.\n\nOn this page the user can add new learning resources to the lesson.",
      },
      saveBeforeExitSnackbarText: {
        message: 'Saving your changes…',
        context: 'Notification that changes are being saved.',
      },
      // only shown on search page
      exitSearchButtonLabel: {
        message: 'Exit search',
        context: "Button to exit the search function of the 'Manage lesson resources' window.",
      },
      manageResourcesAction: {
        message: 'Manage lesson resources',
        context:
          "In the 'Manage lesson resources' coaches can add new resource material to a lesson.",
      },
    },
  };

</script>


<style lang="scss" scoped>

  @import '~kolibri-design-system/lib/styles/definitions';

  .search-filters {
    margin-top: 24px;
  }

  .bookmark-container {
    display: flex;
    min-height: 141px;
    margin-bottom: 24px;
    border-radius: 2px;
    box-shadow: 0 1px 5px 0 #a1a1a1, 0 2px 2px 0 #e6e6e6, 0 3px 1px -2px #ffffff;
    transition: box-shadow 0.25s ease;
  }

  .mobile-bookmark-container {
    @extend %dropshadow-2dp;

    display: flex;
    max-width: 100%;
    min-height: 141px;
    margin: auto;
    margin-bottom: 24px;
    border-radius: 2px;

    .ease:hover {
      @extend %dropshadow-8dp;
      @extend %md-decelerate-func;

      transition: all $core-time;
    }
  }

  .mobile-bookmark-icon {
    left: 24px !important;
  }

  .mobile-text {
    margin-top: 20px;
    margin-left: 60px;
  }

  .bookmark-container:hover {
    box-shadow: 0 5px 5px -3px #a1a1a1, 0 8px 10px 1px #d1d1d1, 0 3px 14px 2px #d4d4d4;
  }

  .text {
    margin-left: 15rem;
  }

</style>
